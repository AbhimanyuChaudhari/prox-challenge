import anthropic
import json
import base64
from pathlib import Path
from knowledge import search, get_images_for_pages, get_all_images

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are an expert technical support agent for the Vulcan OmniPro 220 multiprocess welder. You help users — typically hobbyists or semi-professional welders standing in their garage — set up, operate, and troubleshoot this machine.

You have access to the full owner's manual, quick start guide, and selection chart via tools.

## Your personality
- Friendly, direct, confident. Like a knowledgeable friend who welds, not a corporate support bot.
- Never talk down to the user. They're not an idiot, just not a professional welder.
- Be concise. Get to the point. Don't pad answers.

## Critical: Multimodal responses
You MUST respond with more than just text whenever possible. You have the ability to generate artifacts — interactive HTML/React components rendered inline in the chat.

When to generate artifacts:
- Polarity or wiring questions → generate an SVG or HTML diagram showing which cable goes where
- Duty cycle questions → generate an interactive HTML table or calculator
- Troubleshooting questions → generate an HTML flowchart or decision tree
- Settings questions (wire speed, voltage for material/thickness) → generate an interactive HTML configurator
- Any question where a visual would be clearer than prose → generate it

## How to include an artifact in your response
When you want to render a visual, include it in your response using this exact format:

<artifact type="html" title="Your Title Here">
<!DOCTYPE html>
<html>
...your complete self-contained HTML with inline CSS and JS...
</html>
</artifact>

Rules for artifacts:
- Must be completely self-contained (no external dependencies except CDN links)
- Use inline CSS and JS
- Make them look clean and professional — dark background (#1a1a1a), accent color (#f97316 orange), white text
- They should be functional and interactive where appropriate
- You can include multiple artifacts in one response

## Tools available
- search_manual: search the manual text for relevant content
- get_page_images: get images from specific manual pages
- get_all_images: get all extracted images from the manual

Always search the manual before answering technical questions. Always check for relevant images when answering visual questions (wiring, diagrams, front panel, etc).
"""

tools = [
    {
        "name": "search_manual",
        "description": "Search the Vulcan OmniPro 220 manual for relevant text content. Use this for any technical question about specs, settings, troubleshooting, or procedures.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query — be specific, e.g. 'MIG duty cycle 240V' or 'flux core polarity setup'"
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of results to return (default 6)",
                    "default": 6
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_page_images",
        "description": "Get images extracted from specific pages of the manual. Use when you know which page has a relevant diagram, schematic, or chart.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "Which document: 'owner_manual', 'quick_start', or 'selection_chart'"
                },
                "pages": {
                    "type": "array",
                    "items": {"type": "integer"},
                    "description": "List of page numbers to get images from"
                }
            },
            "required": ["source", "pages"]
        }
    },
    {
        "name": "get_all_images",
        "description": "Get all images from the manual. Use when looking for diagrams, schematics, weld diagnosis photos, or the selection chart.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source_filter": {
                    "type": "string",
                    "description": "Optional: filter by source — 'owner_manual', 'quick_start', or 'selection_chart'",
                }
            },
            "required": []
        }
    }
]


def process_tool_call(tool_name: str, tool_input: dict) -> str:
    if tool_name == "search_manual":
        results = search(tool_input["query"], tool_input.get("top_k", 6))
        if not results:
            return "No relevant content found for this query."
        output = []
        for r in results:
            output.append(f"[{r['source']} - Page {r['page']}]\n{r['text']}")
        return "\n\n---\n\n".join(output)

    elif tool_name == "get_page_images":
        images = get_images_for_pages(tool_input["source"], tool_input["pages"])
        if not images:
            return "No images found on those pages."
        return json.dumps([{
            "id": img["id"],
            "source": img["source"],
            "page": img["page"],
            "ext": img["ext"],
            "b64": img["image_b64"]
        } for img in images])

    elif tool_name == "get_all_images":
        all_imgs = get_all_images()
        source_filter = tool_input.get("source_filter")
        if source_filter:
            all_imgs = [i for i in all_imgs if i["source"] == source_filter]
        if not all_imgs:
            return "No images found."
        return json.dumps([{
            "id": img["id"],
            "source": img["source"],
            "page": img["page"],
            "ext": img["ext"],
            "b64": img["image_b64"]
        } for img in all_imgs])

    return "Unknown tool."


def build_image_tool_result(tool_use_id: str, images_json: str) -> dict:
    """Build a tool result that includes actual images for Claude to see."""
    try:
        images = json.loads(images_json)
        content = []
        for img in images[:6]:  # limit to 6 images
            content.append({
                "type": "text",
                "text": f"Image from {img['source']} page {img['page']} (id: {img['id']}):"
            })
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": f"image/{img['ext']}",
                    "data": img["b64"]
                }
            })
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": content
        }
    except Exception:
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": images_json
        }


def chat(messages: list[dict], user_image_b64: str = None, user_image_media_type: str = None) -> dict:
    """
    Run the agent loop.
    messages: list of {role, content} dicts (conversation history)
    Returns: {text: str, artifacts: list[dict]}
    """

    # if the last user message has an image, inject it
    if user_image_b64 and messages:
        last = messages[-1]
        if last["role"] == "user":
            text_content = last["content"] if isinstance(last["content"], str) else ""
            messages[-1] = {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": user_image_media_type or "image/jpeg",
                            "data": user_image_b64
                        }
                    },
                    {"type": "text", "text": text_content}
                ]
            }

    api_messages = messages.copy()

    # agentic loop
    while True:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=tools,
            messages=api_messages
        )

        # add assistant response to history
        api_messages.append({
            "role": "assistant",
            "content": response.content
        })

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = process_tool_call(block.name, block.input)

                    # if it's an image result, pass actual images to Claude
                    if block.name in ("get_page_images", "get_all_images"):
                        tool_results.append(
                            build_image_tool_result(block.id, result)
                        )
                    else:
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result
                        })

            api_messages.append({
                "role": "user",
                "content": tool_results
            })
        else:
            break

    # extract final text response
    final_text = ""
    for block in response.content:
        if hasattr(block, "text"):
            final_text += block.text

    # parse out artifacts
    artifacts = []
    import re
    pattern = r'<artifact\s+type="([^"]+)"\s+title="([^"]+)">(.*?)</artifact>'
    matches = re.findall(pattern, final_text, re.DOTALL)
    for match in matches:
        artifacts.append({
            "type": match[0],
            "title": match[1],
            "content": match[2].strip()
        })

    # remove artifact tags from display text
    clean_text = re.sub(pattern, f"\n\n*[{{}}: artifact rendered below]*\n\n", final_text, flags=re.DOTALL)
    for a in artifacts:
        clean_text = clean_text.replace("{}", a["title"], 1)

    return {
        "text": clean_text.strip(),
        "artifacts": artifacts
    }