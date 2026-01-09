#!/usr/bin/env python3
import argparse
import os
import sys
import json
import re

def parse_workflow_status_yaml(filepath):
    content = None
    try:
        with open(filepath, 'r') as f:
            content = f.read()
    except Exception:
        return None

    data = None
    workflow_status = None
    if content:
        # Try PyYAML if available
        try:
            import yaml
            loaded = yaml.safe_load(content)
            if isinstance(loaded, dict) and "workflow_status" in loaded:
                workflow_status = loaded["workflow_status"]
        except Exception:
            workflow_status = None

    if workflow_status is None:
        # Fallback to a lightweight, order-preserving parse
        workflow_status = {}
        lines = content.splitlines() if content else []
        in_block = False
        for line in lines:
            if not in_block:
                if line.strip().startswith("workflow_status:"):
                    in_block = True
                continue
            m = re.match(r'^\s{2}([A-Za-z0-9_-]+):\s*(.*)$', line)
            if m:
                key, val = m.group(1), m.group(2).strip()
                if key.endswith("_completed_at"):
                    # metadata about a completed workflow
                    continue
                workflow_status[key] = val
            else:
                # end of block or non-matching line
                if line.strip() == "":
                    continue
                # ignore other lines
                pass

    if not isinstance(workflow_status, dict):
        workflow_status = {}

    return {
        "path": filepath,
        "content": content,
        "workflow_status": workflow_status
    }

def infer_next_from_status_dict(status_dict):
    # Identify completed keys via _completed_at or path values
    completed = set()
    # collect explicit completed_at
    for k, v in status_dict.items():
        if k.endswith("_completed_at"):
            base = k[:-14]
            completed.add(base)
    # Iterate in insertion order if available
    items = list(status_dict.items())
    next_workflow = None
    for k, v in items:
        if k.endswith("_completed_at"):
            continue
        if k in completed:
            continue
        # if value looks like a path, treat as completed
        if isinstance(v, str) and v.startswith("_"):
            completed.add(k)
            continue
        if isinstance(v, str) and v.lower() == "skipped":
            completed.add(k)
            continue
        next_workflow = k
        break

    next_status = None
    if next_workflow:
        val = status_dict.get(next_workflow)
        if isinstance(val, str) and val:
            if val.startswith("_"):
                next_status = "completed"
            else:
                next_status = "pending"
        else:
            next_status = "pending"

    return {"next_workflow": next_workflow, "status": next_status}

def build_status_summary(status_dict):
    total = sum(1 for k in status_dict.keys() if not k.endswith("_completed_at"))
    completed = sum(1 for k in status_dict.keys() if k.endswith("_completed_at") or (isinstance(status_dict.get(k), str) and status_dict.get(k).startswith("_")))
    return {"total_workflows": total, "completed_workflows": completed}

def main():
    parser = argparse.ArgumentParser(description="Lightweight workflow-status reader (read-only).")
    parser.add_argument("--path", "-p", required=True, help="Path to bmm workflow-status YAML file")
    parser.add_argument("--mode", "-m", choices=["status", "next", "summary"], default="status", help="Operation mode")
    args = parser.parse_args()

    path = args.path
    if not os.path.exists(path):
        print(json.dumps({"exists": False, "path": path}))
        return

    content = ""
    with open(path, "r") as f:
        content = f.read()

    # Attempt to parse using PyYAML if available
    workflow_status = {}
    loaded_status = None
    try:
        import yaml
        loaded = yaml.safe_load(content)
        if isinstance(loaded, dict) and "workflow_status" in loaded:
            ws = loaded["workflow_status"]
            if isinstance(ws, dict):
                # Preserve insertion order in Python 3.7+
                for k, v in ws.items():
                    if not k.endswith("_completed_at"):
                        workflow_status[k] = v
            loaded_status = loaded
    except Exception:
        loaded_status = None

    if not workflow_status:
        # Fallback to a best-effort parse
        lines = content.splitlines() if content else []
        capturing = False
        for line in lines:
            if not capturing:
                if line.strip().startswith("workflow_status:"):
                    capturing = True
                    continue
            else:
                m = re.match(r'^\s{2}([A-Za-z0-9_-]+):\s*(.*)$', line)
                if m:
                    key, val = m.group(1), m.group(2).strip()
                    if key.endswith("_completed_at"):
                        continue
                    workflow_status[key] = val

    result = {"exists": True, "path": path}
    if args.mode == "status":
        result["workflow_status"] = workflow_status
        if loaded_status and "generated" in loaded_status:
            result["generated"] = loaded_status["generated"]
    elif args.mode == "next":
        next_info = infer_next_from_status_dict(workflow_status)
        result["next_workflow"] = next_info["next_workflow"]
        result["next_status"] = next_info["status"]
        result["workflow_status"] = workflow_status
    elif args.mode == "summary":
        summary = build_status_summary(workflow_status)
        result["summary"] = summary

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()