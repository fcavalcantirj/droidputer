"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Braces,
  ChevronRight,
  CircleHelp,
  Cpu,
  Download,
  GitBranch,
  CodeXml,
  LayoutDashboard,
  Menu,
  Play,
  Radio,
  Smartphone,
  Terminal,
  Usb,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PLAY_URL, REPO_URL, type View } from "@/lib/telemetry";

export const navigation = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "phones", name: "Phone activity", icon: Smartphone },
  { id: "apps", name: "App ecosystem", icon: Boxes },
  { id: "builds", name: "Build pipeline", icon: GitBranch },
  { id: "play", name: "Google Play", icon: Play },
  { id: "data", name: "Raw data", icon: Braces },
] as const;

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Droidputer home">
      <span className="brand-mark">
        <Terminal size={21} strokeWidth={2.5} />
      </span>
      <span>
        droid<span className="text-primary">puter</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}

function SidebarContent({
  view,
  version,
  close,
}: {
  view: View;
  version?: string;
  close?: () => void;
}) {
  return (
    <>
      <div className="sidebar-brand">
        <Brand />
      </div>
      <a className="play-pill" href={PLAY_URL} data-track="sidebar" target="_blank" rel="noreferrer">
        <Play size={13} fill="currentColor" strokeWidth={0} />
        <span>
          <small>GET IT ON</small>
          Google Play
        </span>
        <ArrowUpRight size={13} className="ml-auto" />
      </a>
      <div className="workspace-label">
        <span className="workspace-icon">
          <Cpu size={16} />
        </span>
        <div>
          <strong>Project dashboard</strong>
          <span>Open-source. Open data.</span>
        </div>
        <span className="status-dot ml-auto" />
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        <p className="nav-section-label">WORKSPACE</p>
        {navigation.map((item) => (
          <Link
            key={item.id}
            href={item.id === "overview" ? "/" : `/?view=${item.id}`}
            scroll={false}
            onClick={close}
            className={cn("nav-link", view === item.id && "active")}
            aria-current={view === item.id ? "page" : undefined}
          >
            <item.icon size={17} strokeWidth={1.7} />
            <span>{item.name}</span>
            {item.id === "overview" && <span className="nav-live">LIVE</span>}
          </Link>
        ))}
        <p className="nav-section-label resources-label">RESOURCES</p>
        <a
          className="nav-link"
          href={`${REPO_URL}#how-to-use`}
          data-track="sidebar_docs"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen size={17} strokeWidth={1.7} />
          <span>Documentation</span>
          <ArrowUpRight className="ml-auto" size={13} />
        </a>
        <a
          className="nav-link"
          href={REPO_URL}
          data-track="sidebar_repo"
          target="_blank"
          rel="noreferrer"
        >
          <CodeXml size={17} strokeWidth={1.7} />
          <span>GitHub repository</span>
          <ArrowUpRight className="ml-auto" size={13} />
        </a>
        <Link
          className={cn("nav-link", view === "about" && "active")}
          href="/?view=about"
          scroll={false}
          onClick={close}
          aria-current={view === "about" ? "page" : undefined}
        >
          <CircleHelp size={17} strokeWidth={1.7} />
          <span>About Droidputer</span>
        </Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="open-source-note">
          <div className="flex items-center gap-2">
            <GitBranch size={15} />
            <strong>Built in the open.</strong>
          </div>
          <p>
            Small hardware. A community
            <br />
            of endless possibilities.
          </p>
          <a href={REPO_URL} data-track="sidebar_star" target="_blank" rel="noreferrer">
            Star us on GitHub <ArrowUpRight size={13} />
          </a>
        </div>
        <div className="sidebar-version">
          <span className="flex items-center gap-2">
            <span className="status-dot" /> Droidputer {version || "OSS"}
          </span>
          <a
            href={`${REPO_URL}/releases`}
            data-track="sidebar_releases"
            aria-label="View releases"
            target="_blank"
            rel="noreferrer"
          >
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ view, version }: { view: View; version?: string }) {
  return (
    <aside className="sidebar">
      <SidebarContent view={view} version={version} />
    </aside>
  );
}

export function Topbar({
  view,
  version,
  connected,
  onInstall,
}: {
  view: View;
  version?: string;
  connected: boolean;
  onInstall: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const name =
    navigation.find((item) => item.id === view)?.name ?? "About Droidputer";
  return (
    <>
      <header className="topbar">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <span className="breadcrumb-root">Workspace</span>
          <ChevronRight size={13} className="breadcrumb-root" />
          <span className="breadcrumb-current">{name}</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <span className="topbar-status">
            <span className={cn("status-dot", !connected && "status-muted")} />
            Public telemetry
          </span>
          <span className="topbar-divider" />
          <a
            className="github-header"
            href={REPO_URL}
            data-track="topbar"
            target="_blank"
            rel="noreferrer"
            aria-label="Open Droidputer on GitHub"
          >
            <CodeXml size={18} />
          </a>
          <Button onClick={onInstall} size="lg">
            <Download data-icon="inline-start" />
            Get Droidputer
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      </header>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="mobile-navigation">
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation</DialogTitle>
            <DialogDescription>
              Explore Droidputer telemetry and resources.
            </DialogDescription>
          </DialogHeader>
          <SidebarContent
            view={view}
            version={version}
            close={() => setMobileOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InstallDialog({
  open,
  setOpen,
  version,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  version?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="install-dialog sm:max-w-lg">
        <DialogHeader>
          <div className="install-icon">
            <Cpu size={24} />
          </div>
          <DialogTitle>Your next tiny computer.</DialogTitle>
          <DialogDescription>
            One Android phone, one ESP32-S3, and a USB cable. That&apos;s your
            entire setup.
          </DialogDescription>
        </DialogHeader>
        <ol className="setup-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Install Droidputer</strong>
              <p>
                From Google Play, or the release APK. Android 8+ with USB-OTG
                support is required.
              </p>
            </div>
            <ArrowDownToLine size={18} />
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Plug in your ESP32-S3</strong>
              <p>
                Use a data-capable OTG cable and the board&apos;s native USB
                port, not UART.
              </p>
            </div>
            <Usb size={18} />
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Pick an app. Make it yours.</strong>
              <p>
                Open Catalog, choose your board, build an app, then flash it
                from your phone.
              </p>
            </div>
            <Radio size={18} />
          </li>
        </ol>
        <a
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
          href={PLAY_URL}
          data-track="install_dialog"
          target="_blank"
          rel="noreferrer"
        >
          <Play data-icon="inline-start" fill="currentColor" strokeWidth={0} />
          Get it on Google Play
          <ArrowUpRight data-icon="inline-end" />
        </a>
        <a
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
          href={`${REPO_URL}/releases/latest`}
          data-track="install_dialog_apk"
          target="_blank"
          rel="noreferrer"
        >
          <Download data-icon="inline-start" />
          Download latest APK{" "}
          {version && <span className="opacity-60">{version}</span>}
          <ArrowUpRight data-icon="inline-end" />
        </a>
        <a
          href={`${REPO_URL}#how-to-use`}
          data-track="install_dialog_guide"
          className="setup-guide"
          target="_blank"
          rel="noreferrer"
        >
          Read the complete setup guide <ArrowUpRight size={13} />
        </a>
      </DialogContent>
    </Dialog>
  );
}
