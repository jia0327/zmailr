import React from "react";
import { useTranslation } from "react-i18next";
import Container from "./Container";

interface FooterProps {
  onShowInfo: (infoType: "privacy" | "terms" | "about") => void;
}

const Footer: React.FC<FooterProps> = ({ onShowInfo }) => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t py-4 mt-auto">
      <Container>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm text-muted-foreground">
          <span>© {year} {t("app.title")}</span>
          <span className="hidden sm:inline text-border">·</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onShowInfo("privacy")}
              className="hover:text-foreground transition-colors"
            >
              {t("common.privacyPolicy", "隐私政策")}
            </button>
            <button
              onClick={() => onShowInfo("terms")}
              className="hover:text-foreground transition-colors"
            >
              {t("common.terms", "使用条款")}
            </button>
            <button
              onClick={() => onShowInfo("about")}
              className="hover:text-foreground transition-colors"
            >
              {t("common.about", "关于我们")}
            </button>
          </div>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
