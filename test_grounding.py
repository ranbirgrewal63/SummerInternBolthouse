from groundingdino.util.inference import load_model, load_image, predict
import cv2

model = load_model(
    "weights/GroundingDINO_SwinT_OGC.py",
    "weights/groundingdino_swint_ogc.pth"
)

TEXT_PROMPT = "rock . rubber band . plastic . debris . stone"
BOX_THRESHOLD = 0.35
TEXT_THRESHOLD = 0.25

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
ret, frame = cap.read()
cap.release()

cv2.imwrite("test_frame.jpg", frame)

image_source, image = load_image("test_frame.jpg")

boxes, logits, phrases = predict(
    model=model,
    image=image,
    caption=TEXT_PROMPT,
    box_threshold=BOX_THRESHOLD,
    text_threshold=TEXT_THRESHOLD,
)

print("Detected:", phrases)
print("Confidence:", logits)