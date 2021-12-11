@echo on
cls
curl -X POST http://localhost:3000/api/test -H "Content-Type: application/json" -H "Token: admin"
::-d '{key: value}'
