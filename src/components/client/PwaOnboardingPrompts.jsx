import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Share } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const INSTALL_DISMISSED_KEY = 'maki-install-prompt-dismissed';
const NOTIFICATION_PROMPT_KEY = 'maki-notification-prompt-shown';

const isStandaloneApp = () => window.matchMedia?.('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

const isIosDevice = () => /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !window.MSStream;

const persistPromptState = (storage, key) => {
  try {
    storage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
};

export default function PwaOnboardingPrompts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPhone, setIsPhone] = useState(() => window.matchMedia?.('(max-width: 767px)').matches ?? false);
  const [standalone, setStandalone] = useState(() => isStandaloneApp());
  const [installOpen, setInstallOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const phoneQuery = window.matchMedia?.('(max-width: 767px)');
    const updateStandalone = () => setStandalone(isStandaloneApp());
    const updatePhone = () => setIsPhone(phoneQuery?.matches ?? false);
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      updateStandalone();
      setInstallOpen(false);
    };

    mediaQuery?.addEventListener?.('change', updateStandalone);
    phoneQuery?.addEventListener?.('change', updatePhone);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      mediaQuery?.removeEventListener?.('change', updateStandalone);
      phoneQuery?.removeEventListener?.('change', updatePhone);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isPhone) {
      setInstallOpen(false);
      return;
    }
    if (standalone) {
      setInstallOpen(false);
      return;
    }

    try {
      if (sessionStorage.getItem(INSTALL_DISMISSED_KEY) !== '1') setInstallOpen(true);
    } catch {
      setInstallOpen(true);
    }
  }, [isPhone, standalone]);

  useEffect(() => {
    if (!isPhone || !standalone || !user?.id || ['admin', 'seller', 'deliverer'].includes(user.role)) return;
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;

    const storageKey = `${NOTIFICATION_PROMPT_KEY}:${user.id}`;
    try {
      if (localStorage.getItem(storageKey) === '1') return;
    } catch {
      return;
    }

    let cancelled = false;
    const checkSubscription = async () => {
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        const subscription = await registration?.pushManager?.getSubscription().catch(() => null);
        if (subscription || cancelled) return;
      }
      if (!cancelled) setNotificationOpen(true);
    };

    void checkSubscription();
    return () => { cancelled = true; };
  }, [isPhone, standalone, user?.id, user?.role]);

  const dismissInstallPrompt = () => {
    persistPromptState(sessionStorage, INSTALL_DISMISSED_KEY);
    setInstallOpen(false);
  };

  const openInstallPrompt = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      return;
    }
    setInstallPrompt(null);
    dismissInstallPrompt();
  };

  const openNotificationSettings = () => {
    persistPromptState(localStorage, `${NOTIFICATION_PROMPT_KEY}:${user.id}`);
    setNotificationOpen(false);
    navigate('/loja/conta?section=notifications');
  };

  const dismissNotificationPrompt = () => {
    persistPromptState(localStorage, `${NOTIFICATION_PROMPT_KEY}:${user.id}`);
    setNotificationOpen(false);
  };

  return (
    <>
      <Dialog open={installOpen} onOpenChange={(open) => !open && dismissInstallPrompt()}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-t-3xl rounded-b-none border-0 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-12 sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-lg">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl">Adicione a Maki Food à tela inicial</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              Abra a loja como um aplicativo e acompanhe seus pedidos com mais facilidade. No app instalado, você também pode ativar notificações de atualização do pedido.
            </DialogDescription>
          </DialogHeader>

          {isIosDevice() ? (
            <div className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              <Share className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p>No Safari, toque em Compartilhar e escolha <strong>Adicionar à Tela de Início</strong>. Depois, abra a Maki Food pelo ícone criado.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {installPrompt
                ? 'Instale o aplicativo para abrir a Maki Food direto pela tela inicial.'
                : 'No menu do navegador, escolha “Adicionar à tela inicial” ou “Instalar aplicativo”. Depois, abra pelo ícone criado.'}
            </p>
          )}

          <DialogFooter className="gap-2 sm:flex-col-reverse sm:space-x-0">
            <Button variant="outline" onClick={dismissInstallPrompt}>Agora não</Button>
            {installPrompt && (
              <Button onClick={openInstallPrompt} className="bg-emerald-700 hover:bg-emerald-800">
                Adicionar à tela inicial
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notificationOpen} onOpenChange={(open) => !open && dismissNotificationPrompt()}>
        <DialogContent className="top-auto bottom-0 translate-y-0 rounded-t-3xl rounded-b-none border-0 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-12 sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%] sm:rounded-lg">
          <DialogHeader className="text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Bell className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl">Ative as notificações dos pedidos</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              Receba avisos quando seu pedido entrar em separação, sair para entrega ou for entregue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:flex-col-reverse sm:space-x-0">
            <Button variant="outline" onClick={dismissNotificationPrompt}>Agora não</Button>
            <Button onClick={openNotificationSettings} className="bg-emerald-700 hover:bg-emerald-800">
              Ir para notificações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}