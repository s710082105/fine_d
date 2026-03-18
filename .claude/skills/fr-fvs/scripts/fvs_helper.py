"""FVS 模板辅助函数 - 解压/打包/JSON 操作"""

import re
import json
import os
import shutil
import zipfile


def fvs_extract(fvs_path, work_dir):
    """解压 FVS 到工作目录，返回 content 目录路径"""
    os.makedirs(work_dir, exist_ok=True)
    shutil.copy(fvs_path, os.path.join(work_dir, 'template.zip'))
    with zipfile.ZipFile(os.path.join(work_dir, 'template.zip'), 'r') as z:
        z.extractall(os.path.join(work_dir, 'content'))
    return os.path.join(work_dir, 'content')


def fvs_read_store(content_dir):
    """读取 editor.tpl 中的 store JSON，返回 (data, original_content)"""
    tpl_path = os.path.join(content_dir, 'editor.tpl')
    with open(tpl_path, 'r', encoding='utf-8') as f:
        content = f.read()
    m = re.search(r'store="(.*?)"', content)
    store_json = (m.group(1)
                  .replace('&quot;', '"')
                  .replace('&amp;', '&')
                  .replace('&lt;', '<')
                  .replace('&gt;', '>'))
    return json.loads(store_json), content


def fvs_write_store(content_dir, data, original_content):
    """将修改后的 store JSON 写回 editor.tpl"""
    new_store = json.dumps(data, ensure_ascii=False)
    new_store_escaped = (new_store
                         .replace('&', '&amp;')
                         .replace('"', '&quot;')
                         .replace('<', '&lt;')
                         .replace('>', '&gt;'))
    new_content = re.sub(r'store=".*?"', f'store="{new_store_escaped}"', original_content)
    tpl_path = os.path.join(content_dir, 'editor.tpl')
    with open(tpl_path, 'w', encoding='utf-8') as f:
        f.write(new_content)


def fvs_pack(content_dir, output_path):
    """将工作目录打包为 FVS"""
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(content_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, content_dir)
                zf.write(file_path, arcname)


def fvs_list_widgets(data, story_index=None):
    """列出所有 widget 信息，返回字典列表"""
    result = []
    stories = data.get("stories", [])
    for i, story in enumerate(stories):
        if story_index is not None and i != story_index:
            continue
        for j, w in enumerate(story.get("widgets", [])):
            states = w.get("states", {})
            matrix = states.get("matrix", [1, 0, 0, 1, 0, 0])
            result.append({
                "story": i,
                "index": j,
                "name": w.get("name", ""),
                "type": w.get("type", ""),
                "widgetType": w.get("widgetType", ""),
                "displayName": w.get("displayName", ""),
                "x": matrix[4] if len(matrix) > 4 else 0,
                "y": matrix[5] if len(matrix) > 5 else 0,
                "width": states.get("width", 0),
                "height": states.get("height", 0),
                "id": w.get("id", ""),
                "hide": w.get("hide", False)
            })
    return result
