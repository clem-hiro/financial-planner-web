"use server";

import { revalidatePath } from "next/cache";
import {
  fulfillAccessKeyPurchase,
  getMyAdvisorContact,
  validateCouponForPurchase,
  type AccessKeyPurchaseQuote,
  type AdvisorContactResult,
} from "@/data/repositories/coupons";
import { ACCESS_KEY_PRODUCT_CODE } from "@/data/repositories/pricing";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isAdvisor } from "@/lib/profile-role";
import { formatSupabaseError } from "@/lib/supabase-error";
import {
  advisorAccessKeyPurchaseQuantitySchema,
  couponCodeInputSchema,
} from "@/lib/validation";

export type BuyAccessKeysFormState = {
  error: string | null;
  info: string | null;
  purchaseId: string | null;
  keys: string[];
};

async function requireAdvisorSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null, error: "Sign in required" };
  }

  const profile = await getProfileById(supabase, user.id);
  if (!isAdvisor(profile)) {
    return {
      supabase,
      user,
      profile,
      error: "Only financial advisors can use this action.",
    };
  }

  return { supabase, user, profile, error: null };
}

function emptyQuote(
  message: string,
  quantity = 0
): AccessKeyPurchaseQuote {
  return {
    ok: false,
    message,
    product_code: ACCESS_KEY_PRODUCT_CODE,
    quantity,
    currency: "SGD",
    unit_price_cents: 0,
    free_key_quantity: 0,
    paid_key_quantity: 0,
    gross_cents: 0,
    discount_cents: 0,
    net_cents: 0,
    coupon_code: null,
  };
}

export async function validateCouponForPurchaseAction(input: {
  quantity: number;
  couponCode: string;
}): Promise<AccessKeyPurchaseQuote> {
  const session = await requireAdvisorSession();
  if (session.error) {
    return emptyQuote(session.error);
  }

  const quantityParsed = advisorAccessKeyPurchaseQuantitySchema.safeParse(
    input.quantity
  );
  if (!quantityParsed.success) {
    return emptyQuote("Choose between 1 and 1000 keys.");
  }

  const couponParsed = couponCodeInputSchema.safeParse(input.couponCode);
  if (!couponParsed.success) {
    return emptyQuote("Invalid coupon format.", quantityParsed.data);
  }

  try {
    return await validateCouponForPurchase(
      session.supabase,
      quantityParsed.data,
      couponParsed.data
    );
  } catch (e) {
    return emptyQuote(
      formatSupabaseError(e, "Could not validate coupon."),
      quantityParsed.data
    );
  }
}

export async function buyAdvisorAccessKeysAction(
  _prev: BuyAccessKeysFormState,
  formData: FormData
): Promise<BuyAccessKeysFormState> {
  const session = await requireAdvisorSession();
  if (session.error) {
    return { error: session.error, info: null, purchaseId: null, keys: [] };
  }

  const quantityParsed = advisorAccessKeyPurchaseQuantitySchema.safeParse(
    formData.get("quantity")
  );
  if (!quantityParsed.success) {
    return {
      error: "Choose between 1 and 1000 keys.",
      info: null,
      purchaseId: null,
      keys: [],
    };
  }

  const couponParsed = couponCodeInputSchema.safeParse(
    String(formData.get("coupon_code") ?? "")
  );
  if (!couponParsed.success) {
    return {
      error: "Invalid coupon format.",
      info: null,
      purchaseId: null,
      keys: [],
    };
  }

  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return {
      error: "Invalid purchase token. Refresh and try again.",
      info: null,
      purchaseId: null,
      keys: [],
    };
  }

  try {
    const result = await fulfillAccessKeyPurchase(
      session.supabase,
      quantityParsed.data,
      idempotencyKey,
      couponParsed.data
    );
    if (!result.ok) {
      return {
        error: result.message ?? "Could not complete purchase.",
        info: null,
        purchaseId: null,
        keys: [],
      };
    }

    revalidatePath("/advisor");
    revalidatePath("/advisor/access-keys");
    revalidatePath("/advisor/buy-keys");

    return {
      error: null,
      info: `Added ${result.keys.length} access keys.`,
      purchaseId: result.purchase_id,
      keys: result.keys,
    };
  } catch (e) {
    return {
      error: formatSupabaseError(e, "Could not complete purchase."),
      info: null,
      purchaseId: null,
      keys: [],
    };
  }
}

export async function getMyAdvisorContactAction(): Promise<AdvisorContactResult> {
  const supabase = await createSupabaseServerClient();
  try {
    return await getMyAdvisorContact(supabase);
  } catch (e) {
    return {
      available: false,
      advisor_name: null,
      whatsapp_url: null,
      message: formatSupabaseError(e, "Advisor contact is unavailable."),
    };
  }
}
