# Docs

### GET /api/skins/:xuid
```json5
{
	"timestamp": "Date.now() on when skin was saved",
	"skinId": "string",
	"skinData": "base64 encoded png file",
	"capeData": "base64 encoded png file",
	"geometryData": "string",
	"geometryName": "string"
}
```

### POST /api/skins/:xuid
```json5
{
	"success": true
}
```
