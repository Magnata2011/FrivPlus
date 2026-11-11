export type ChatAttachmentKind = "image" | "video" | "document";

const attachmentTypes: Record<string, { contentType: string; kind: ChatAttachmentKind }> = {
  png: { contentType: "image/png", kind: "image" },
  jpg: { contentType: "image/jpeg", kind: "image" },
  jpeg: { contentType: "image/jpeg", kind: "image" },
  webp: { contentType: "image/webp", kind: "image" },
  mp4: { contentType: "video/mp4", kind: "video" },
  webm: { contentType: "video/webm", kind: "video" },
  mov: { contentType: "video/quicktime", kind: "video" },
  pdf: { contentType: "application/pdf", kind: "document" },
  txt: { contentType: "text/plain", kind: "document" },
  doc: { contentType: "application/msword", kind: "document" },
  docx: { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" },
  xls: { contentType: "application/vnd.ms-excel", kind: "document" },
  xlsx: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "document" },
  ppt: { contentType: "application/vnd.ms-powerpoint", kind: "document" },
  pptx: { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "document" },
};

export function getChatAttachmentType(fileName: string, declaredType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const attachment = attachmentTypes[extension];
  if (!attachment || (declaredType && declaredType !== attachment.contentType)) return null;
  return { ...attachment, extension };
}

export function sanitizeChatAttachmentName(fileName: string) {
  return fileName
    .replace(/[\\/\u0000-\u001f\u007f"]/g, "_")
    .trim()
    .slice(0, 180);
}
