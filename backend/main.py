import base64
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import json
from dotenv import load_dotenv

load_dotenv()

from agent import chat

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/chat")
async def chat_endpoint(
    messages: str = Form(...),
    image: Optional[UploadFile] = File(None)
):
    try:
        parsed_messages = json.loads(messages)

        image_b64 = None
        image_media_type = None

        if image:
            image_bytes = await image.read()
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
# detect real media type from magic bytes
            if image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
                image_media_type = "image/webp"
            elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
                image_media_type = "image/png"
            elif image_bytes[:2] == b'\xff\xd8':
                image_media_type = "image/jpeg"
            else:
                image_media_type = image.content_type or "image/jpeg"

        result = chat(parsed_messages, image_b64, image_media_type)
        return JSONResponse(content=result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/health")
def health():
    return {"status": "ok"}