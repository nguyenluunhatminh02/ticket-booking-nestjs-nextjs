"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_FLAGS: Record<Locale, string> = {
  vi: "VI",
  en: "EN",
};

type Dictionary = Record<string, string>;

const vi: Dictionary = {
  "common.appName": "Đặt Vé",
  "common.cancel": "Hủy",
  "common.page": "Trang",
  "common.of": "trên",
  "common.loading": "Đang tải...",
  "common.noResults": "Không tìm thấy kết quả",
  "common.clearHistory": "Xóa lịch sử",
  "common.tip": "Mẹo",
  "common.records": "bản ghi",
  "auth.signIn": "Đăng nhập",
  "auth.signUp": "Đăng ký",
  "auth.enterCredentials": "Nhập thông tin đăng nhập để tiếp tục",
  "auth.email": "Email",
  "auth.password": "Mật khẩu",
  "auth.forgotPassword": "Quên mật khẩu?",
  "auth.rememberMe": "Ghi nhớ đăng nhập",
  "auth.continueWith": "Hoặc tiếp tục với",
  "auth.noAccount": "Chưa có tài khoản?",
  "nav.booking": "Đặt vé",
  "nav.account": "Tài khoản",
  "tickets.title": "Vé của tôi",
  "tickets.subtitle": "Xem và quản lý vé của bạn",
  "tickets.valid": "Hợp lệ",
  "tickets.used": "Đã dùng",
  "tickets.cancelled": "Đã hủy",
  "tickets.expired": "Hết hạn",
  "tickets.ticketCount": "{count} vé",
  "tickets.noTickets": "Chưa có vé",
  "tickets.noTicketsDesc": "Khám phá sự kiện và đặt vé đầu tiên của bạn",
  "tickets.browseEvents": "Xem sự kiện",
  "tickets.tier": "Hạng vé",
  "tickets.seat": "Ghế",
  "tickets.code": "Mã vé",
  "tickets.price": "Giá",
  "tickets.qrCode": "Mã QR",
  "tickets.qrLoadFailed": "Không tải được mã QR",
  "tickets.qrPresent": "Xuất trình mã QR này khi check-in",
  "events.title": "Sự kiện",
  "events.subtitle": "Khám phá sự kiện",
  "events.searchPlaceholder": "Tìm kiếm sự kiện...",
  "events.allEvents": "Tất cả sự kiện",
  "events.eventsFound": "Tìm thấy {count} sự kiện",
  "events.hideMap": "Ẩn bản đồ",
  "events.showMap": "Hiện bản đồ",
  "events.watchNow": "Xem ngay",
  "checkIn.title": "Check-in",
  "checkIn.subtitle": "Quét vé để check-in người tham dự",
  "checkIn.totalScans": "Tổng lượt quét",
  "checkIn.success": "Thành công",
  "checkIn.failed": "Thất bại",
  "checkIn.scanQrCode": "Quét mã QR",
  "checkIn.manualEntry": "Nhập thủ công",
  "checkIn.cameraScanner": "Quét bằng camera",
  "checkIn.cameraDesc": "Quét mã QR trên vé bằng camera của bạn",
  "checkIn.enterTicketCode": "Nhập mã vé",
  "checkIn.manualDesc": "Nhập hoặc dán mã vé",
  "checkIn.ticketCodePlaceholder": "Mã vé",
  "checkIn.usbTip": "Máy quét USB hoạt động như bàn phím — chọn ô nhập rồi quét",
  "checkIn.checkInHistory": "Lịch sử check-in",
  "checkIn.noHistory": "Chưa có lượt check-in",
  "languages.vi": "Tiếng Việt",
  "languages.en": "English",
};

const en: Dictionary = {
  "common.appName": "Ticket Booking",
  "common.cancel": "Cancel",
  "common.page": "Page",
  "common.of": "of",
  "common.loading": "Loading...",
  "common.noResults": "No results found",
  "common.clearHistory": "Clear history",
  "common.tip": "Tip",
  "common.records": "records",
  "auth.signIn": "Sign in",
  "auth.signUp": "Sign up",
  "auth.enterCredentials": "Enter your credentials to continue",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot password?",
  "auth.rememberMe": "Remember me",
  "auth.continueWith": "Or continue with",
  "auth.noAccount": "Don't have an account?",
  "nav.booking": "Booking",
  "nav.account": "Account",
  "tickets.title": "My Tickets",
  "tickets.subtitle": "View and manage your tickets",
  "tickets.valid": "Valid",
  "tickets.used": "Used",
  "tickets.cancelled": "Cancelled",
  "tickets.expired": "Expired",
  "tickets.ticketCount": "{count} tickets",
  "tickets.noTickets": "No tickets yet",
  "tickets.noTicketsDesc": "Browse events and book your first ticket",
  "tickets.browseEvents": "Browse events",
  "tickets.tier": "Tier",
  "tickets.seat": "Seat",
  "tickets.code": "Code",
  "tickets.price": "Price",
  "tickets.qrCode": "QR Code",
  "tickets.qrLoadFailed": "Failed to load QR code",
  "tickets.qrPresent": "Present this QR code at check-in",
  "events.title": "Events",
  "events.subtitle": "Discover events",
  "events.searchPlaceholder": "Search events...",
  "events.allEvents": "All events",
  "events.eventsFound": "{count} events found",
  "events.hideMap": "Hide map",
  "events.showMap": "Show map",
  "events.watchNow": "Watch now",
  "checkIn.title": "Check-in",
  "checkIn.subtitle": "Scan tickets to check in attendees",
  "checkIn.totalScans": "Total scans",
  "checkIn.success": "Success",
  "checkIn.failed": "Failed",
  "checkIn.scanQrCode": "Scan QR code",
  "checkIn.manualEntry": "Manual entry",
  "checkIn.cameraScanner": "Camera scanner",
  "checkIn.cameraDesc": "Scan ticket QR codes with your camera",
  "checkIn.enterTicketCode": "Enter ticket code",
  "checkIn.manualDesc": "Type or paste a ticket code",
  "checkIn.ticketCodePlaceholder": "Ticket code",
  "checkIn.usbTip": "USB scanners work like keyboards — focus the input and scan",
  "checkIn.checkInHistory": "Check-in history",
  "checkIn.noHistory": "No check-ins yet",
  "languages.vi": "Tiếng Việt",
  "languages.en": "English",
};

const dictionaries: Record<Locale, Dictionary> = { vi, en };

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "vi",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "locale-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const template = dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match
      );
    },
    [locale]
  );

  return { t, locale, setLocale };
}
