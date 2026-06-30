import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/surveys/$id")({
  head: () => ({ meta: [{ title: "Compose — Insightform" }] }),
  component: SurveyRedirect,
});

function SurveyRedirect() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/surveys/$id/edit", params: { id }, replace: true });
  }, [id, navigate]);
  return null;
}
