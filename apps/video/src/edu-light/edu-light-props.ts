import type { z } from "zod/v4";
import eduVerticalRedisFixture from "../../fixtures/edu-vertical-redis-props.json";
import { RenderPropsError, slotRenderPropsSchema } from "../render-props/schema";

/**
 * Template thứ hai (P5-03): cùng 5 slot và cùng cấu trúc render props với EduVertical, khác `templateId`,
 * theme sáng và bố cục. Chưa nối vào workflow: worker vẫn dựng props EduVertical.
 */
export const EDU_LIGHT_TEMPLATE_ID = "EduLight" as const;
export const EDU_LIGHT_TEMPLATE_VERSION = "1.0.0";
export const EDU_LIGHT_COMPOSITION_ID = "EduLight";

export const eduLightRenderPropsSchema = slotRenderPropsSchema(EDU_LIGHT_TEMPLATE_ID);

export type EduLightRenderProps = z.infer<typeof eduLightRenderPropsSchema>;

export function parseEduLightRenderProps(input: unknown): EduLightRenderProps {
  const parsed = eduLightRenderPropsSchema.safeParse(input);
  if (!parsed.success) {
    throw new RenderPropsError(parsed.error.message);
  }
  return parsed.data;
}

/** Fixture Redis của EduVertical với `templateId` của EduLight; nội dung, timing và caption giữ nguyên. */
export const EDU_LIGHT_DEFAULT_PROPS: EduLightRenderProps = parseEduLightRenderProps({
  ...eduVerticalRedisFixture,
  templateId: EDU_LIGHT_TEMPLATE_ID,
  templateVersion: EDU_LIGHT_TEMPLATE_VERSION,
});
