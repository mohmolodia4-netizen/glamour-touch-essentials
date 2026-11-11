import { afterEach, expect, mock, test } from "bun:test";
import { convertProductImage } from "./product-image";

const originalImage = globalThis.Image;
const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.Image = originalImage;
  globalThis.document = originalDocument;
});

function setup(width, height, outputType = "image/webp") {
  const drawImage = mock(() => {});
  const toBlob = mock((callback, type, quality) => {
    callback(new Blob([`${type}:${quality}`], { type: outputType }));
  });
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob };
  class TestImage {
    naturalWidth = width;
    naturalHeight = height;
    onload;
    set src(_value) { this.onload?.(); }
  }
  globalThis.Image = TestImage;
  globalThis.document = { createElement: () => canvas };
  return { canvas, toBlob };
}

test("caps width at 1200px while preserving aspect ratio", async () => {
  const { canvas } = setup(2400, 1600);
  await convertProductImage(new File(["input"], "bag.jpg", { type: "image/jpeg" }));
  expect(canvas.width).toBe(1200);
  expect(canvas.height).toBe(800);
});

test("does not upscale smaller images", async () => {
  const { canvas } = setup(600, 900);
  await convertProductImage(new File(["input"], "bag.png", { type: "image/png" }));
  expect(canvas.width).toBe(600);
  expect(canvas.height).toBe(900);
});

test("encodes WebP with quality 0.8", async () => {
  const { toBlob } = setup(1200, 800);
  await convertProductImage(new File(["input"], "bag.jpg", { type: "image/jpeg" }));
  expect(toBlob.mock.calls[0]?.slice(1)).toEqual(["image/webp", 0.8]);
});

test("renames the converted file with a .webp extension and MIME type", async () => {
  setup(600, 400);
  const file = await convertProductImage(new File(["input"], "bag.front.JPG", { type: "image/jpeg" }));
  expect(file.name).toBe("bag.front.webp");
  expect(file.type).toBe("image/webp");
});

test("rejects unsupported WebP encoding instead of uploading a mislabeled image", async () => {
  setup(600, 400, "image/png");
  await expect(convertProductImage(new File(["input"], "bag.png", { type: "image/png" }))).rejects.toThrow("WebP");
});