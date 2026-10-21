import { NextResponse } from "next/server";
import { createMpPayment, hasMercadoPago, pixFromPayment } from "@/lib/mercadoPago";
import { getOrder, markOrderStatus } from "@/lib/orders";

export async function POST(request: Request) {
  if (!hasMercadoPago()) {
    return NextResponse.json({ error: "Checkout não configurado" }, { status: 503 });
  }

  let body: {
    orderId?: string;
    formData?: Record<string, unknown>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  const formData = body.formData;
  if (!orderId || !formData || typeof formData !== "object") {
    return NextResponse.json({ error: "Dados do pagamento incompletos" }, { status: 400 });
  }

  const order = await getOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status === "approved") {
    return NextResponse.json({
      ok: true,
      alreadyApproved: true,
      id: order.mp_payment_id,
      status: "approved",
    });
  }

  try {
    const payment = await createMpPayment({
      orderId: order.id,
      planId: order.plan_id,
      role: order.role,
      amountBrl: Number(order.amount_brl),
      formData,
      payerEmail: order.payer_email,
    });

    if (payment.status === "pending" || payment.status === "in_process") {
      await markOrderStatus(order.id, "pending", String(payment.id));
    }

    return NextResponse.json({
      ok: true,
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      pix: pixFromPayment(payment),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no pagamento";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
