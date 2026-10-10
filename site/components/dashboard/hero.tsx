import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  CircuitBoard,
  Keyboard,
  MapPin,
  Monitor,
  Play,
  Usb,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAY_URL, REPO_URL } from "@/lib/telemetry";

export function HardwareHero({ onInstall }: { onInstall: () => void }) {
  return (
    <section className="hardware-hero" aria-label="Meet Droidputer">
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <span className="status-dot" /> LITTLE BOARD. BIG POTENTIAL.
        </div>
        <h2>
          Your phone.
          <br />A whole new <span>computer.</span>
        </h2>
        <p>
          Give an ESP32-S3 your phone&apos;s screen, keyboard, and GPS.
          <br className="hidden xl:block" /> The entire Cardputer ecosystem. One
          USB cable.
        </p>
        <div className="hero-actions">
          <a
            className={`${buttonVariants()} hero-play`}
            href={PLAY_URL}
            data-track="hero"
            target="_blank"
            rel="noreferrer"
          >
            <Play data-icon="inline-start" fill="currentColor" strokeWidth={0} />
            Get it on Google Play
          </a>
          <Button variant="outline" onClick={onInstall}>
            Meet Droidputer <ArrowRight data-icon="inline-end" />
          </Button>
          <a
            href={`${REPO_URL}#under-the-hood`}
            data-track="hero_how"
            target="_blank"
            rel="noreferrer"
          >
            How it works <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
      <div className="hero-hardware">
        <Image
          src="/images/droidputer-hardware.png"
          alt="Product illustration of an Android phone connected to an ESP32-S3 development board over USB"
          width={1264}
          height={848}
          priority
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 42vw, 480px"
        />
        <div className="hardware-caption">
          <span>
            <CircuitBoard size={12} /> ESP32-S3
          </span>
          <span className="connection-line" />
          <Usb size={13} />
          <span className="connection-line" />
          <span>ANDROID</span>
        </div>
      </div>
      <div className="hero-foot">
        <span>
          <Monitor />
          Screen
        </span>
        <span>
          <Keyboard />
          Keyboard
        </span>
        <span>
          <MapPin />
          GPS
        </span>
        <span className="hero-foot-note">
          The ESP does the computing. Your phone does the rest.
        </span>
        <Badge variant="outline">100% open source</Badge>
      </div>
    </section>
  );
}
