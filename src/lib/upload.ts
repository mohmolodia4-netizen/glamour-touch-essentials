import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadImage(file: File): Promise<string> {
  const nameExt = file.name.includes(".") ? file.name.split(".").pop() : undefined;
  const typeExt = file.type.includes("/") ? file.type.split("/").pop() : undefined;
  const ext = (nameExt ?? typeExt ?? "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const options: { cacheControl: string; upsert: boolean; contentType?: string } = {
    cacheControl: "31536000",
    upsert: false,
  };
  if (file.type) options.contentType = file.type;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, options);
  if (error) throw new Error(error.message);

  const { data, error: signError } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, TEN_YEARS);
  if (signError || !data) throw new Error(signError?.message ?? "Lien image invalide");
  return data.signedUrl;
}
