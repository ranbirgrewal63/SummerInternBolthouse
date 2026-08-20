import requests
response = requests.get("http://10.5.5.9:8080/gopro/version")
print(response.json())