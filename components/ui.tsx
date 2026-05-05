"use client";

import { ArrowLeft, X } from "lucide-react";

type ClassNameProps = {
  className?: string;
};

export function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Panel({
  children,
  className,
  ...props
}: React.PropsWithChildren<ClassNameProps & React.HTMLAttributes<HTMLElement>>) {
  return (
    <section {...props} className={cx("panel", className)}>
      {children}
    </section>
  );
}

export function InputShell({
  children,
  className,
  ...props
}: React.PropsWithChildren<ClassNameProps & React.LabelHTMLAttributes<HTMLLabelElement>>) {
  return (
    <label {...props} className={cx("input-shell", className)}>
      {children}
    </label>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  ClassNameProps & {
    variant?: "primary" | "secondary" | "danger";
  }) {
  return (
    <button
      {...props}
      className={cx(
        variant === "primary" ? "button" : undefined,
        variant === "secondary" ? "button-secondary" : undefined,
        variant === "danger" ? "button button-danger" : undefined,
        className
      )}
    >
      {children}
    </button>
  );
}

export function Spinner() {
  return <div className="spinner" aria-hidden="true" />;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cx("skeleton-block", className)} aria-hidden="true" />;
}

export function OverviewSkeleton() {
  return (
    <div className="screen-stack">
      <Panel className="skeleton-panel">
        <div className="panel-title-row">
          <div className="skeleton-copy">
            <SkeletonBlock className="skeleton-title" />
            <SkeletonBlock className="skeleton-line" />
          </div>
          <SkeletonBlock className="skeleton-icon" />
        </div>

        <div className="hero-timer hero-timer--skeleton">
          <div className="skeleton-ring" />
          <SkeletonBlock className="skeleton-button" />
        </div>
      </Panel>

      <Panel className="skeleton-panel">
        <div className="panel-title-row">
          <div className="skeleton-copy">
            <SkeletonBlock className="skeleton-title" />
            <SkeletonBlock className="skeleton-line short" />
          </div>
          <SkeletonBlock className="skeleton-icon" />
        </div>
        <div className="metric-grid">
          <SkeletonBlock className="skeleton-metric" />
          <SkeletonBlock className="skeleton-metric" />
        </div>
        <SkeletonBlock className="skeleton-progress" />
      </Panel>

      <Panel className="skeleton-panel full-width">
        <div className="panel-title-row">
          <div className="skeleton-copy">
            <SkeletonBlock className="skeleton-title" />
            <SkeletonBlock className="skeleton-line" />
          </div>
        </div>
        <div className="list-stack">
          <SkeletonBlock className="skeleton-list-item" />
          <SkeletonBlock className="skeleton-list-item" />
          <SkeletonBlock className="skeleton-list-item" />
        </div>
      </Panel>
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="loading-state">
      <div className="loading-state-copy">
        <div className="loading-state-brand">
          <div className="loading-state-ring" aria-hidden="true" />
        </div>
        <p className="empty-copy">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  copy
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="empty-state">
      <div>
        <p className="empty-title">{title}</p>
        <p className="empty-copy">{copy}</p>
      </div>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  onBack,
  size = "default",
  children
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  size?: "default" | "wide";
}>) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={cx("modal-card", size === "wide" ? "modal-card-wide" : undefined)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-row">
            {onBack ? (
              <button className="ghost-button" onClick={onBack} aria-label="Go back">
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div className="modal-heading">
              <h3 className="panel-title">{title}</h3>
              {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <button className="ghost-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
