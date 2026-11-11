/** Browser-only conversion, called from product upload event handlers. */
export async function convertProductImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choisissez une image valide.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de lire cette image."));
      image.src = url;
    });

    const scale = Math.min(1, 1200 / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("La conversion d'image est indisponible.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (!result || result.type !== "image/webp") {
          reject(new Error("Impossible de convertir cette image en WebP."));
          return;
        }
        resolve(result);
      }, "image/webp", 0.8);
    });
    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${name}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(url);
  }
}