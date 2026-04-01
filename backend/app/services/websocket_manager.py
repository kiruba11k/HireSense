from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active = {}

    async def connect(self, task_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active[task_id] = websocket

    def disconnect(self, task_id: str):
        self.active.pop(task_id, None)

    async def send(self, task_id: str, message: dict):
        ws = self.active.get(task_id)
        if ws:
            await ws.send_json(message)

manager = ConnectionManager()
