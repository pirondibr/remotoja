import { redirect } from "next/navigation";

/** /v2 virou a home. Mantém o path antigo redirecionando. */
export default function HomeV2Redirect() {
  redirect("/");
}
