import React from "react";
import { useSettings } from "@/context/SettingsContext";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { settings } = useSettings() || {};
  const logoUrl = settings?.logo_url;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={settings?.app_name || "Logo"} className="w-full h-full object-cover" />
            ) : (
              <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 relative">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
        {logoUrl && (
          <div className="flex justify-center mt-8 opacity-60">
            <img src={logoUrl} alt="" className="h-6 object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}
