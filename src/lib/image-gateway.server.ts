export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
};

export function generateImage(
  config: ImageConfig,
  prompt: string,
  stream = true,
) {
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Lovable-API-Key": config.apiKey,
      "X-Lovable-AIG-SDK": "fetch",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      size: "1536x1024",
      quality: "medium",
      ...(stream ? { stream: true, partial_images: 1 } : {}),
    }),
  });
}