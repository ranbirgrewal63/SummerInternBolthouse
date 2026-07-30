import cv2
import os

def extract_all_frames(video_path, output_folder):
    # Create output directory if it doesn't exist
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        
    # Open the video file
    video = cv2.VideoCapture(video_path)
    frame_count = 0
    
    while True:
        # Read the next frame
        success, frame = video.read()
        
        # If the frame was not successfully read, we reached the end of the video
        if not success:
            break
            
        # Format filename with zero-padding so files sort correctly
        output_path = os.path.join(output_folder, f"frame_{frame_count:04d}.jpg")
        
        # Save the frame
        cv2.imwrite(output_path, frame)
        frame_count += 1
        
    # Release the video object
    video.release()
    print(f"Successfully extracted {frame_count} frames.")

# Example Usage
extract_all_frames("your_video.mp4", "extracted_frames")