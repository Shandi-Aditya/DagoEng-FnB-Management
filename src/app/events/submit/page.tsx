"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  MapPin,
  Upload,
  Link as LinkIcon,
  User,
  Mail,
  Phone,
  Tag,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EventCategory, EventSubmissionPayload } from "@/types/event";

const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "WORKSHOP", label: "Workshop & Masterclass" },
  { value: "MEETUP", label: "Komunitas & Meetup" },
  { value: "CREATIVE", label: "Seni & Industri Kreatif" },
  { value: "TECH", label: "Teknologi & Startup" },
  { value: "COMMUNITY", label: "Aksi Sosial & Lingkungan" },
  { value: "SEMINAR", label: "Seminar & Talkshow" },
  { value: "OTHER", label: "Lainnya" },
];

export default function SubmitEventPage() {
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState<EventSubmissionPayload>({
    organizerName: "",
    organizerEmail: "",
    organizerPhone: "",
    title: "",
    category: "COMMUNITY",
    description: "",
    startDate: "",
    endDate: "",
    location: "Dago Creative Hub, Bandung",
    isPaid: false,
    price: 0,
    posterUrl: "",
    externalRegistrationUrl: "",
    guidelines: "",
    honeypot: "",
  });

  const [posterPreview, setPosterPreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submittedEventId, setSubmittedEventId] = useState<string>("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "posterUrl") {
      setPosterPreview(value.trim());
    }
  };

  const handlePricingToggle = (isPaid: boolean) => {
    setFormData((prev) => ({
      ...prev,
      isPaid,
      price: isPaid ? (prev.price && prev.price > 0 ? prev.price : 25000) : 0,
    }));
  };

  const validateClient = (): boolean => {
    const errors: string[] = [];

    if (!formData.organizerName.trim() || formData.organizerName.trim().length < 2) {
      errors.push("Nama penyelenggara wajib diisi (minimal 2 karakter).");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.organizerEmail.trim() || !emailRegex.test(formData.organizerEmail.trim())) {
      errors.push("Format email penyelenggara tidak valid.");
    }

    const phoneRegex = /^(\+62|62|0)[0-9\s-]{8,15}$/;
    if (!formData.organizerPhone.trim() || !phoneRegex.test(formData.organizerPhone.trim())) {
      errors.push("Nomor WhatsApp/telepon tidak valid (contoh: 08123456789).");
    }

    if (!formData.title.trim() || formData.title.trim().length < 3) {
      errors.push("Judul event wajib diisi (minimal 3 karakter).");
    }

    if (!formData.description.trim() || formData.description.trim().length < 10) {
      errors.push("Deskripsi event wajib diisi (minimal 10 karakter).");
    }

    if (!formData.startDate) {
      errors.push("Tanggal dan waktu mulai wajib diisi.");
    }
    if (!formData.endDate) {
      errors.push("Tanggal dan waktu selesai wajib diisi.");
    }
    if (
      formData.startDate &&
      formData.endDate &&
      new Date(formData.endDate).getTime() < new Date(formData.startDate).getTime()
    ) {
      errors.push("Waktu selesai tidak boleh mendahului waktu mulai.");
    }

    if (!formData.location.trim() || formData.location.trim().length < 3) {
      errors.push("Lokasi event wajib diisi.");
    }

    if (formData.isPaid && (!formData.price || formData.price <= 0)) {
      errors.push("Harga tiket wajib diisi lebih dari Rp 0 untuk event berbayar.");
    }

    if (!formData.posterUrl.trim()) {
      errors.push("URL poster event wajib diisi.");
    } else {
      try {
        const u = new URL(formData.posterUrl.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errors.push("URL poster harus menggunakan protokol HTTP atau HTTPS.");
        }
      } catch {
        errors.push("Format URL poster tidak valid.");
      }
    }

    if (formData.externalRegistrationUrl?.trim()) {
      try {
        const u = new URL(formData.externalRegistrationUrl.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          errors.push("URL pendaftaran eksternal harus HTTP atau HTTPS.");
        }
      } catch {
        errors.push("Format URL pendaftaran eksternal tidak valid.");
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // Client-side validation
    if (!validateClient()) {
      window.scrollTo({ top: 180, behavior: "smooth" });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: formData.isPaid ? Number(formData.price) : 0,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.details && Array.isArray(data.details)) {
          setValidationErrors(data.details);
        } else {
          setGeneralError(data.error || "Gagal mengirim pengajuan event.");
        }
        window.scrollTo({ top: 180, behavior: "smooth" });
        return;
      }

      setSubmitSuccess(true);
      setSubmittedEventId(data.data?.id || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setGeneralError(err.message || "Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-[#1E293B] dark:text-[#E2E8F0] transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0F172A]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/events"
              className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Kembali ke Event
            </Link>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Pasang Event Komunitas
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle variant="pill" />
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Beranda DAGO
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {submitSuccess ? (
          /* SUCCESS STATE */
          <Card className="p-8 sm:p-10 border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-center shadow-lg rounded-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <Badge variant="outline" className="mb-3 border-emerald-600 text-emerald-700 dark:text-emerald-400">
              STATUS: PENDING MODERASI
            </Badge>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Pengajuan Event Berhasil Diterima!
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed mb-6">
              Terima kasih telah mengajukan event di Dago Creative Hub. Tim kurator kami akan
              memeriksa kelayakan dan ketersediaan ruang dalam waktu 1x24 jam kerja.
            </p>

            <div className="p-4 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 text-left text-xs space-y-2 mb-8 max-w-md mx-auto shadow-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">ID Pengajuan:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{submittedEventId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Judul:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                  {formData.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Kontak Penyelenggara:</span>
                <span className="text-slate-800 dark:text-slate-200">{formData.organizerPhone}</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                Pemberitahuan persetujuan atau permintaan revisi akan dikonfirmasikan via kontak di atas.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/events">
                <Button className="w-full sm:w-auto bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold px-6 shadow-md shadow-emerald-900/10">
                  Lihat Event Publik Lainnya
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitSuccess(false);
                  setFormData({
                    organizerName: "",
                    organizerEmail: "",
                    organizerPhone: "",
                    title: "",
                    category: "COMMUNITY",
                    description: "",
                    startDate: "",
                    endDate: "",
                    location: "Dago Creative Hub, Bandung",
                    isPaid: false,
                    price: 0,
                    posterUrl: "",
                    externalRegistrationUrl: "",
                    honeypot: "",
                  });
                  setPosterPreview("");
                }}
                className="w-full sm:w-auto text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              >
                Ajukan Event Lain
              </Button>
            </div>
          </Card>
        ) : (
          /* FORM SUBMISSION */
          <div>
            {/* Header info */}
            <div className="mb-8">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-400 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Terbuka untuk Komunitas Kreatif Bandung & Sekitarnya</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                Pasang Event Komunitas
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Publikasikan lokakarya, meetup kreatif, atau temu komunitasmu di ekosistem Dago Creative Hub.
                Pengajuan tidak memerlukan pembuatan akun dan akan ditinjau oleh Admin sebelum tayang di publik.
              </p>
            </div>

            {/* Error alerts */}
            {validationErrors.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs space-y-1">
                <div className="font-bold flex items-center mb-1">
                  <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
                  Mohon periksa kembali isian formulir:
                </div>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {generalError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* HONEYPOT ANTI-SPAM TRAP (Hidden from real users) */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  name="honeypot"
                  tabIndex={-1}
                  value={formData.honeypot}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
              </div>

              {/* SECTION 1: Organizer Contact */}
              <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                <div className="flex items-center space-x-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Informasi Penyelenggara
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Kontak privat untuk keperluan konfirmasi & moderasi oleh Admin.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nama Penyelenggara / Komunitas <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        name="organizerName"
                        required
                        value={formData.organizerName}
                        onChange={handleInputChange}
                        placeholder="Contoh: Dago Coffee Enthusiasts / Studio Priangan"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Alamat Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        name="organizerEmail"
                        required
                        value={formData.organizerEmail}
                        onChange={handleInputChange}
                        placeholder="penyelenggara@email.com"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nomor WhatsApp / Telepon <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="tel"
                        name="organizerPhone"
                        required
                        value={formData.organizerPhone}
                        onChange={handleInputChange}
                        placeholder="08123456789 atau +6281234..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* SECTION 2: Event Details */}
              <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                <div className="flex items-center space-x-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Rincian Acara
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Informasi yang akan tampil pada kartu dan halaman publik setelah disetujui.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Judul Event <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      required
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="Contoh: Bandung Coffee Sensory Calibration & Latte Art Meetup"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Kategori Event <span className="text-rose-500">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Lokasi / Ruang Pelaksanaan <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          name="location"
                          required
                          value={formData.location}
                          onChange={handleInputChange}
                          placeholder="Contoh: Amphitheater Lt. 2 / Co-Working Lounge"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Waktu Mulai <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="startDate"
                        required
                        value={formData.startDate}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Waktu Selesai <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="endDate"
                        required
                        value={formData.endDate}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Deskripsi Lengkap Event <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      name="description"
                      required
                      rows={4}
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Jelaskan agenda acara, pemateri/fasilitator, sasaran peserta, dan fasilitas yang didapatkan..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 resize-y"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Panduan & Ketentuan Khusus Acara <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <span className="text-[10px] text-slate-400">1 baris per poin panduan</span>
                    </div>
                    <textarea
                      name="guidelines"
                      rows={3}
                      value={formData.guidelines as string}
                      onChange={handleInputChange}
                      placeholder={"Contoh:\nHarap membawa laptop dan charger masing-masing\nGunakan pakaian santai & bersepatu\nHadir 15 menit sebelum acara untuk registrasi"}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100 resize-y"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Poin-poin ini akan tampil pada kotak &quot;Panduan Menghadiri Acara&quot; di halaman detail event publik.
                    </p>
                  </div>
                </div>
              </Card>

              {/* SECTION 3: Pricing & Poster */}
              <Card className="p-6 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
                <div className="flex items-center space-x-2.5 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-[#3B7A57] dark:text-[#52B788] flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Harga, Poster & Tautan Pendaftaran
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pendaftaran peserta dikelola via link eksternal penyelenggara (Google Form, Loket, dsb).
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* Gratis vs Berbayar Toggle */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Jenis Tiket / Biaya Masuk
                    </label>
                    <div className="grid grid-cols-2 gap-3 max-w-sm">
                      <button
                        type="button"
                        onClick={() => handlePricingToggle(false)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          !formData.isPaid
                            ? "bg-[#3B7A57] text-white border-[#3B7A57] shadow-sm"
                            : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        Gratis (Free Entry)
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePricingToggle(true)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          formData.isPaid
                            ? "bg-[#3B7A57] text-white border-[#3B7A57] shadow-sm"
                            : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        Berbayar (Paid)
                      </button>
                    </div>
                  </div>

                  {/* Nominal jika Berbayar */}
                  {formData.isPaid && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Nominal Tiket (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          name="price"
                          min={1000}
                          step={5000}
                          value={formData.price || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))
                          }
                          placeholder="50000"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Dago Creative Hub tidak memotong komisi tiket acara komunitas. Pembayaran langsung ke rekening penyelenggara.
                      </p>
                    </div>
                  )}

                  {/* Poster URL */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      URL Gambar Poster Event <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Upload className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="url"
                        name="posterUrl"
                        required
                        value={formData.posterUrl}
                        onChange={handleInputChange}
                        placeholder="https://images.unsplash.com/... atau URL gambar publik"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {posterPreview && (
                      <div className="mt-3 flex items-center space-x-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={posterPreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={() => setPosterPreview("")}
                          />
                        </div>
                        <div className="text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                            Pratinjau Poster Terdeteksi
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Pastikan gambar memiliki rasio landscape atau 4:3 dengan resolusi tajam.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* External Registration Link */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      URL Pendaftaran Eksternal (Opsional)
                    </label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="url"
                        name="externalRegistrationUrl"
                        value={formData.externalRegistrationUrl || ""}
                        onChange={handleInputChange}
                        placeholder="https://bit.ly/daftar-event / https://loket.com/..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B7A57] text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Jika diisi, tombol &quot;Daftar Sekarang&quot; akan langsung mengarahkan peserta ke link ini.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Informational banner */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/50 flex items-start space-x-3 text-xs text-emerald-900 dark:text-emerald-300">
                <Info className="w-5 h-5 text-[#3B7A57] dark:text-[#52B788] flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block">Kebijakan Moderasi Komunitas:</span>
                  Semua pengajuan akan berstatus <span className="font-semibold underline">PENDING</span> dan tidak akan langsung muncul pada Landing Page publik sebelum diperiksa oleh admin Dago Creative Hub.
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <Link href="/events">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  >
                    Batal
                  </Button>
                </Link>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#3B7A57] hover:bg-[#2E6044] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-900/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Mengirimkan Pengajuan...
                    </span>
                  ) : (
                    "Kirim Pengajuan Event"
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
