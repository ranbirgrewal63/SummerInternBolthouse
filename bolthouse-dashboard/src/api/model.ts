import { API_BASE_URL } from "./config";

export async function runModelInference(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/run-inference`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Inference request failed: ${response.status}`);
  }

  return response.json();
}
