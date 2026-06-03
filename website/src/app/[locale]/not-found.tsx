import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center gap-6 py-20 text-center">
      <span className="font-display text-7xl text-terracotta-ink">{t("code")}</span>
      <h1 className="font-display text-3xl">{t("title")}</h1>
      <p className="max-w-md text-pretty text-muted">{t("body")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" size="md">
          {t("home")}
        </ButtonLink>
        <ButtonLink href="/docs" variant="secondary" size="md">
          {t("docs")}
        </ButtonLink>
      </div>
    </Container>
  );
}
