"use client";

import Image from "next/image";

/** Shared favicon + name brand block used by office, group, and login. */
export function BrandMark({
  name,
  badge,
  tag,
  className,
}: {
  name: string;
  badge?: string;
  tag?: string;
  className?: string;
}) {
  return (
    <div className={className ?? "sidebar-brand"}>
      <Image
        src="/icons/favicon-32.png"
        alt=""
        width={28}
        height={28}
        className="sidebar-brand-logo"
        priority
      />
      <div className="sidebar-brand-copy">
        <div className="sidebar-brand-row">
          <span className="sidebar-brand-name" title={name}>
            {name}
          </span>
          {badge ? <span className="sidebar-brand-badge">{badge}</span> : null}
        </div>
        {tag ? <div className="sidebar-brand-tag">{tag}</div> : null}
      </div>
    </div>
  );
}
