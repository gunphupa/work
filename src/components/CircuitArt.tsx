import { useId } from "react";
import { useLanguage } from "../i18n";
export function ProjectArt({
  kind = "light",
  hero = false,
}: {
  kind?: string;
  hero?: boolean;
}) {
  const grid = useId();
  const { t } = useLanguage();
  if (kind === "craft")
    return (
      <svg
        viewBox="0 0 500 330"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={t(
          "ภาพประกอบจรวดกระดาษ ไม่ใช่แบบตัด",
          "Paper rocket concept illustration, not a cutting template",
        )}
        className="project-art"
      >
        <rect width="500" height="330" fill="#efe7d5" />
        <path
          d="M150 275Q100 165 235 70"
          stroke="#ba9670"
          strokeWidth="2"
          strokeDasharray="6 8"
          fill="none"
        />
        <g transform="translate(290 148) rotate(28)">
          <path
            d="M-24 67V-63L0-105 24-63V67Z"
            fill="#fbfaf2"
            stroke="#cabf9e"
            strokeWidth="2"
          />
          <path d="M-24 35L-55 80-24 68M24 35L55 80 24 68" fill="#bd7950" />
          <path d="M0-105L24-63H-24Z" fill="#79946c" />
          <path d="M0 65v75" stroke="#bdac7e" strokeWidth="10" />
          <path d="M-12 -37h24m-24 10h24" stroke="#9ba38a" strokeWidth="2" />
        </g>
        <g transform="translate(84 230) rotate(-10)">
          <rect width="94" height="54" fill="#f9f5e9" />
          <path
            d="M14 14h65m-65 9h48m-48 9h57"
            stroke="#c3ba9e"
            strokeWidth="2"
          />
        </g>
        <text
          x="36"
          y="46"
          fontFamily="monospace"
          fontSize="13"
          letterSpacing="2"
          fill="#827550"
        >
          LITTLE THINGS TAKE FLIGHT
        </text>
      </svg>
    );
  return (
    <svg
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 500 330"
      role="img"
      aria-label={
        hero
          ? t(
              "ภาพประกอบโต๊ะทดลอง Arduino และชิ้นส่วน",
              "Arduino workbench illustration",
            )
          : t(
              "ภาพประกอบแนวคิดโปรเจกต์ ไม่ใช่ผังต่อวงจร",
              "Project concept illustration, not a wiring diagram",
            )
      }
      className={hero ? "hero-art" : "project-art"}
    >
      <defs>
        <pattern id={grid} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#bcc9b7" opacity=".6" />
        </pattern>
      </defs>
      <rect
        width="500"
        height="330"
        fill={
          kind === "music"
            ? "#eee3d4"
            : kind === "sensor"
              ? "#e8e4d9"
              : "#e3eadf"
        }
      />
      <rect width="500" height="330" fill={`url(#${grid})`} />
      <g transform="translate(90 112) rotate(-8)">
        <rect
          x="4"
          y="8"
          width="213"
          height="137"
          rx="12"
          fill="#0e332d"
          opacity=".15"
        />
        <rect width="213" height="137" rx="12" fill="#23614e" />
        <circle cx="13" cy="13" r="5" fill="#dfd6b7" />
        <circle cx="199" cy="124" r="5" fill="#dfd6b7" />
        <rect x="-15" y="17" width="37" height="36" rx="3" fill="#c4c9c8" />
        <rect x="-10" y="80" width="27" height="22" fill="#243a34" />
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i}>
            <rect x={38 + i * 10} y="9" width="7" height="13" fill="#182e28" />
            <rect
              x={38 + i * 10}
              y="116"
              width="7"
              height="13"
              fill="#182e28"
            />
          </g>
        ))}
        <rect x="65" y="74" width="109" height="22" rx="2" fill="#1b2926" />
        <text
          x="71"
          y="59"
          fill="#ecf0d7"
          fontSize="23"
          fontFamily="monospace"
          fontWeight="bold"
        >
          UNO
        </text>
        <text x="35" y="106" fill="#b9d2b8" fontSize="7" fontFamily="monospace">
          MAKE SOMETHING NEW
        </text>
        <rect x="33" y="35" width="11" height="15" rx="3" fill="#e1d7b5" />
        <circle cx="186" cy="44" r="4" fill="#e6bc54" />
      </g>
      {kind === "music" ? (
        <g transform="translate(350 110)">
          <ellipse cx="0" cy="14" rx="37" ry="32" fill="#303c34" />
          <ellipse rx="37" ry="30" fill="#455346" />
          <circle r="8" fill="#172820" />
          <path
            d="M40 -5q25 20 0 40m14 -52q38 31 0 62"
            fill="none"
            stroke="#d38347"
            strokeWidth="4"
          />
        </g>
      ) : kind === "sensor" ? (
        <g transform="translate(355 130)">
          <circle r="37" fill="#b5b9af" />
          <circle r="28" fill="#495e50" />
          <rect x="-8" y="-46" width="16" height="40" rx="5" fill="#b7bbae" />
          <path
            d="M-20 30v50m20 -45v50m20 -55v50"
            stroke="#8d978b"
            strokeWidth="4"
          />
        </g>
      ) : (
        <g transform="translate(356 95)">
          <path d="M-17 25v60m17 -60v75" stroke="#859187" strokeWidth="4" />
          <path d="M-25 25v-18a17 17 0 0134 0v18z" fill="#e38c4e" />
          <rect x="-28" y="23" width="40" height="7" rx="3" fill="#c57641" />
          <path
            d="M-8 -24v-10m-31 28l-10-7m68 7l10-7"
            stroke="#df9c60"
            strokeWidth="3"
          />
        </g>
      )}
      <path
        d="M270 240c92 20 155-9 134-57"
        fill="none"
        stroke="#d58e52"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g transform="translate(310 255) rotate(-14)">
        <path d="M-25 0h92" stroke="#869687" strokeWidth="3" />
        <rect width="42" height="14" y="-7" rx="5" fill="#d4bc91" />
        <path
          d="M10 -7v14m9 -14v14m13 -14v14"
          stroke="#a16543"
          strokeWidth="4"
        />
      </g>
      {hero && (
        <>
          <g transform="translate(290 32) rotate(7)">
            <rect width="160" height="42" rx="4" fill="#fbfaf1" />
            <text
              x="17"
              y="27"
              fill="#355145"
              fontSize="15"
              fontFamily="monospace"
            >
              a little spark.
            </text>
          </g>
          <text
            x="34"
            y="301"
            fill="#637b67"
            fontSize="11"
            fontFamily="monospace"
          >
            01 / YOUR NEXT POSSIBILITY
          </text>
        </>
      )}
    </svg>
  );
}
