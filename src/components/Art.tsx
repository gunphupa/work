import type { ReactNode } from "react";
import { ProjectArt as CircuitArt } from "./CircuitArt";
const plants = (
  <g>
    <path d="M251 174v-63" stroke="#526c3c" strokeWidth="7" />
    <path d="M250 144c-45 2-62-22-62-39 38-3 62 8 62 39Z" fill="#789b58" />
    <path d="M252 122c3-34 24-47 51-43-1 29-23 49-51 43Z" fill="#416e43" />
  </g>
);
const tape = (
  <g>
    <ellipse cx="395" cy="248" rx="27" ry="12" fill="#cda77f" />
    <path d="M368 233v16c0 16 54 16 54 0v-16" fill="#d9b68a" />
    <ellipse cx="395" cy="231" rx="27" ry="12" fill="#f0d6b1" />
    <ellipse cx="395" cy="231" rx="13" ry="6" fill="#fbf6e9" />
  </g>
);
const artwork: Record<string, ReactNode> = {
  dividers: (
    <>
      <path d="m115 152 196-32 89 49-199 38Z" fill="#f1d8b1" />
      <path d="M115 152v89l86 55v-89Z" fill="#c79660" />
      <path d="m201 207 199-38v86l-199 41Z" fill="#dcb484" />
      <path d="m115 152 86 55 199-38-12 85-187 31-73-48Z" fill="#efd3a8" />
      <path
        d="m160 135 94 52v92m-129-89 213-39v80"
        fill="none"
        stroke="#b88c5e"
        strokeWidth="6"
      />
      <path d="m165 167 30-6 25 16-34 8Z" fill="#859b8a" />
      <path d="m290 230 30-5 12 10-31 6Z" fill="#b97450" />
      <path d="m274 211 18-4 33 18-19 4Z" fill="#d3946d" />
    </>
  ),
  caddy: (
    <>
      <path d="m106 237 206-31 90 43-211 41Z" fill="#c59868" />
      {[
        [148, 133, 81],
        [223, 104, 105],
        [292, 145, 70],
      ].map(([x, y, h]) => (
        <g key={x}>
          <path
            d={`M${x} ${y}v${h}c0 27 63 27 63 0v-${h}`}
            fill={x === 223 ? "#c0905e" : "#d9b486"}
          />
          <ellipse cx={x + 31} cy={y} rx="31" ry="12" fill="#a47d50" />
          <ellipse cx={x + 31} cy={y} rx="24" ry="8" fill="#735e40" />
        </g>
      ))}
      <path
        d="m168 163-15-92m34 92 8-110m46 85-8-88m32 88 13-72m33 111 12-87"
        stroke="#3f6959"
        strokeWidth="9"
      />
      <path
        d="m153 69-2-10m44-8 1-10m33 6-1-10"
        stroke="#ce9a68"
        strokeWidth="9"
      />
    </>
  ),
  cables: (
    <>
      <path d="m108 180 222-35 76 47-222 44Z" fill="#f1dcc0" />
      <path d="m108 180 76 46 222-34v68l-222 40-76-49Z" fill="#cfa674" />
      {[155, 225, 295].map((x, i) => (
        <g key={x}>
          <path d={`M${x} ${177 - i * 7}v66q27 19 49-5v-64`} fill="#dcba8b" />
          <ellipse
            cx={x + 25}
            cy={176 - i * 7}
            rx="25"
            ry="12"
            fill="#ae8659"
          />
          <path
            d={`M${x + 10} ${176 - i * 7}c-15-65 55-67 30 0m-25-5c-8-40 40-40 18 0`}
            fill="none"
            stroke="#556960"
            strokeWidth="6"
          />
        </g>
      ))}
    </>
  ),
  jars: (
    <>
      {[
        [122, 144, 91],
        [244, 102, 128],
        [345, 170, 76],
      ].map(([x, y, h], i) => (
        <g key={x}>
          <rect
            x={x}
            y={y}
            width={i === 1 ? 85 : 70}
            height={h}
            rx="17"
            fill="#c8dbcb"
            stroke="#779383"
            strokeWidth="2"
          />
          <path
            d={`M${x + 12} ${y + 13}v${h - 25}`}
            stroke="#f5fbef"
            strokeWidth="5"
          />
          <rect
            x={x - 2}
            y={y - 11}
            width={i === 1 ? 89 : 74}
            height="18"
            rx="5"
            fill="#b9a582"
          />
          {[0, 1, 2].map((n) => (
            <circle
              key={n}
              cx={x + 22 + n * 16}
              cy={y + h - 25 - (n % 2) * 10}
              r="8"
              fill={i === 1 ? "#b88869" : "#748b79"}
            />
          ))}
          <rect
            x={x + 12}
            y={y + 32}
            width="49"
            height="25"
            rx="2"
            fill="#fffae9"
          />
          <path
            d={`M${x + 23} ${y + 42}h25m-25 7h17`}
            stroke="#8c987a"
            strokeWidth="2"
          />
        </g>
      ))}
    </>
  ),
  stand: (
    <>
      <path d="m136 257 81-131 49 139Z" fill="#c79b68" />
      <path d="m243 242 70-126 49 141Z" fill="#e0b886" />
      <path d="m136 257 107-15 119 15-109 21Z" fill="#b88558" />
      <g transform="translate(210 74) rotate(15)">
        <rect width="109" height="165" rx="12" fill="#365449" />
        <rect x="7" y="12" width="95" height="139" rx="6" fill="#e8eee0" />
        <rect x="22" y="30" width="64" height="45" rx="4" fill="#aec4a0" />
        <path
          d="M23 93h63m-63 13h46m-46 13h55"
          stroke="#91a28b"
          strokeWidth="5"
        />
        <circle cx="54" cy="158" r="3" fill="#b7caba" />
      </g>
      <path d="m136 257 3-16m107 1 3-17" stroke="#ab7950" strokeWidth="9" />
    </>
  ),
  cloths: (
    <>
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          transform={`translate(${145 + i * 18} ${182 - i * 30}) rotate(-8)`}
        >
          <path
            d="M0 0h187v70q-10 12-22 0H0Z"
            fill={["#698b79", "#c79772", "#e9dbc0"][i]}
          />
          <path
            d="M9 8h167v51H9Z"
            fill="none"
            stroke="#fbf5df"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </g>
      ))}
    </>
  ),
  duster: (
    <>
      <path
        d="m228 91 76 13-13 109c-2 34-60 50-99 40-50-13-26-45 18-51Z"
        fill="#9cab86"
      />
      <path d="m225 97 75 12m-78 1 76 12" stroke="#d1d6b3" strokeWidth="7" />
      <path d="M158 244q28-53 58-35" fill="#c7c8a0" />
      {[
        [335, 168],
        [151, 173],
        [350, 245],
      ].map(([x, y]) => (
        <path
          key={x}
          d={`M${x - 7} ${y}h14m-7-7v14`}
          stroke="#bc9462"
          strokeWidth="3"
        />
      ))}
    </>
  ),
  roller: (
    <>
      <g transform="translate(161 151) rotate(-16)">
        <path d="M0 0v87c0 35 198 35 198 0V0" fill="#dec7a0" />
        <ellipse cx="99" rx="99" ry="24" fill="#f3e5c8" />
        <ellipse cx="99" rx="76" ry="13" fill="#967f5d" />
        <path d="M42 24v75m117-74v74" stroke="#f9efd8" strokeWidth="24" />
        <path
          d="m68 62 10 8m40-28-6 14m-5 34 9-3"
          stroke="#6c7762"
          strokeWidth="3"
        />
      </g>
    </>
  ),
  button: (
    <>
      <path d="m136 109 213 14-20 148-213-10Z" fill="#9cac9e" />
      <path
        d="m135 121 35 8-8 129"
        fill="none"
        stroke="#f6f1df"
        strokeWidth="3"
        strokeDasharray="5 5"
      />
      <circle cx="257" cy="188" r="43" fill="#ba8058" />
      <circle
        cx="257"
        cy="188"
        r="34"
        fill="none"
        stroke="#dfb285"
        strokeWidth="2"
      />
      {[
        [246, 176],
        [268, 176],
        [246, 198],
        [268, 198],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#704c38" />
      ))}
      <path
        d="m246 176 22 22m0-22-22 22m21-11c82-4 129 75 92 94"
        fill="none"
        stroke="#faf1d1"
        strokeWidth="3"
      />
      <path d="m360 258 31-80" stroke="#7a9189" strokeWidth="3" />
    </>
  ),
  patch: (
    <>
      <path d="m114 117 251-8 11 162-256 10Z" fill="#6f8c8d" />
      <path d="m118 146 254-10" stroke="#c3d0be" strokeWidth="3" />
      <g transform="translate(207 144) rotate(-7)">
        <rect width="113" height="99" rx="3" fill="#d29b75" />
        <path
          d="M9 9h95v81H9Z"
          fill="none"
          stroke="#fff1d0"
          strokeWidth="3"
          strokeDasharray="5 4"
        />
        <path
          d="M28 0v99m28-99v99m28-99v99M0 31h113M0 64h113"
          stroke="#e6c29a"
          strokeWidth="2"
        />
      </g>
    </>
  ),
  zipper: (
    <>
      <path d="M132 114h220v155H132Z" fill="#bc956f" />
      <path d="M154 160h179" stroke="#6f6656" strokeWidth="14" />
      <path
        d="M153 160h180"
        stroke="#dfcda8"
        strokeWidth="8"
        strokeDasharray="3 4"
      />
      <rect x="244" y="148" width="34" height="25" rx="5" fill="#738178" />
      <path
        d="m263 164c12 18 83 36 59 63-16 18-57-24-59-63Z"
        fill="none"
        stroke="#d7dbbe"
        strokeWidth="7"
      />
      <path
        d="m310 217 8 10 15-3"
        stroke="#4e6b59"
        strokeWidth="5"
        fill="none"
      />
    </>
  ),
  tote: (
    <>
      <path d="M154 149h188l-12 132H167Z" fill="#d4b78a" />
      <path
        d="M181 155v-39c0-80 132-80 132 0v39h-22v-40c0-45-88-45-88 0v40Z"
        fill="#c6a06d"
      />
      <path
        d="M177 263h140"
        stroke="#a58050"
        strokeWidth="3"
        strokeDasharray="5 6"
      />
      <path
        d="M222 213c-22-36 42-47 30-9 36-34 63 21 16 25-7 14-20 23-33 28"
        fill="#5e8253"
      />
      <path d="m251 212-15 36" stroke="#c4c99b" strokeWidth="3" />
    </>
  ),
  gift: (
    <>
      <path d="m153 152 155-32 62 40-152 35Z" fill="#f0cf9d" />
      <path d="M153 152v99l65 42v-98Z" fill="#bb8a65" />
      <path d="m218 195 152-35v95l-152 38Z" fill="#d4ad81" />
      <path
        d="m207 140 64 43v98m-103-48 196-39"
        stroke="#6d896c"
        strokeWidth="19"
      />
      <path
        d="m263 170c-90-10-48-57 0 0 1-61 75-42 0 0Z"
        fill="none"
        stroke="#6d896c"
        strokeWidth="10"
      />
    </>
  ),
  coaster: (
    <>
      <g transform="translate(145 197) rotate(-12)">
        <rect width="208" height="92" rx="6" fill="#b08054" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <g key={i}>
            <path
              d={`M${14 + i * 29} 4v83`}
              stroke={i % 2 ? "#ceb082" : "#ead8b8"}
              strokeWidth="18"
            />
            <path
              d={`M4 ${12 + i * 11}h200`}
              stroke="#c39365"
              strokeWidth="4"
            />
          </g>
        ))}
      </g>
      <path d="M210 128v65q0 45 89 32v-95Z" fill="#eaf0df" />
      <path
        d="M297 144c54-14 39 61 0 38"
        fill="none"
        stroke="#c4d2b8"
        strokeWidth="12"
      />
      <ellipse cx="255" cy="129" rx="44" ry="15" fill="#c6d1b6" />
      <ellipse cx="255" cy="129" rx="33" ry="9" fill="#6e644a" />
    </>
  ),
  planter: (
    <>
      <path
        d="M192 194h120v74q-58 20-120 0Z"
        fill="#b5d0c4"
        stroke="#6c9589"
        strokeWidth="2"
      />
      <path d="M195 231h114v35q-53 16-114 0Z" fill="#8fb9b5" />
      <path
        d="M184 148h136l-47 67h-40Z"
        fill="#b8ceba"
        stroke="#6c9589"
        strokeWidth="2"
      />
      <path d="M194 153h116l-26 35h-64Z" fill="#79624a" />
      <path d="m255 186-4 69" stroke="#eae0b9" strokeWidth="6" />
      {plants}
    </>
  ),
  seedpots: (
    <>
      {[
        [134, 193],
        [226, 162],
        [322, 195],
      ].map(([x, y], i) => (
        <g key={x}>
          <path
            d={`M${x} ${y}l8 72h51l8-72Z`}
            fill={i === 1 ? "#c8a579" : "#d8b98f"}
          />
          <ellipse cx={x + 33} cy={y} rx="33" ry="11" fill="#79634b" />
          <path
            d={`M${x + 33} ${y}v-39m0 19q-27 0-24-22 26-2 24 22m0-7q23-1 21-22-22 0-21 22`}
            fill="#7e9b63"
            stroke="#547b4f"
            strokeWidth="2"
          />
        </g>
      ))}
    </>
  ),
  propagation: (
    <>
      <rect
        x="191"
        y="147"
        width="119"
        height="133"
        rx="22"
        fill="#c9dbcd"
        stroke="#85a194"
        strokeWidth="2"
      />
      <path d="M197 206h107v53q-47 23-107 0Z" fill="#aacbc3" />
      <path
        d="M251 157v75m0-13-21 22m21-11 16 18m-15-8-9 18"
        fill="none"
        stroke="#f8efd0"
        strokeWidth="3"
      />
      {plants}
      <path d="M205 175v72" stroke="#f5f7e8" strokeWidth="5" />
    </>
  ),
  labels: (
    <>
      <path d="M173 188h153l-22 99H196Z" fill="#be8059" />
      <ellipse cx="250" cy="188" rx="77" ry="17" fill="#795e42" />
      {plants}
      <g transform="translate(286 100) rotate(12)">
        <rect width="21" height="130" rx="9" fill="#ead3a7" />
        <path d="M6 17h9m-9 7h9m-9 7h9" stroke="#786a4b" strokeWidth="2" />
      </g>
    </>
  ),
  maze: (
    <>
      <path d="m106 158 211-48 81 97-206 74Z" fill="#e5caa4" />
      <path
        d="m106 158 86 123v17l-86-116Zm86 123 206-74v21l-206 70Z"
        fill="#ba895f"
      />
      <path
        d="m155 151 78 94 39-14-49-64 59-18 59 68m-147-9 41-14m54-11 38-13"
        stroke="#b18b62"
        strokeWidth="8"
        fill="none"
      />
      <circle cx="190" cy="184" r="13" fill="#628c76" />
      <circle cx="186" cy="180" r="4" fill="#c3d4bd" />
    </>
  ),
  hand: (
    <>
      <path
        d="m205 266-46-94q-7-21 10-24l27 34-28-83q-4-22 14-23l30 75-4-96q0-23 18-16l9 103 12-93q5-17 20-9l-8 106 26-69q8-21 22-7l-24 99 27-36q16-13 25 1l-46 110-8 24Z"
        fill="#d6ad79"
      />
      {[
        [183, 108, 229, 257],
        [220, 89, 240, 257],
        [257, 87, 250, 257],
        [285, 122, 261, 257],
      ].map(([x, y, a, b]) => (
        <g key={x}>
          <path d={`M${x} ${y} ${a} ${b}`} stroke="#f5e5bc" strokeWidth="6" />
          <path
            d={`M${x} ${y} ${a} ${b + 43}`}
            stroke="#6c8d74"
            strokeWidth="2"
            strokeDasharray="20 5"
          />
        </g>
      ))}
    </>
  ),
  bridge: (
    <>
      <rect x="104" y="184" width="71" height="98" rx="7" fill="#9fb5a0" />
      <rect x="336" y="169" width="70" height="98" rx="7" fill="#9fb5a0" />
      <path d="m139 185 239-17 0-40-239 18Z" fill="#eee2c5" />
      <path
        d="m139 146 15 25 15-27 15 25 15-27 15 25 15-27 15 25 15-27 15 25 15-27 15 25 15-27 15 25 15-27 15 25"
        fill="none"
        stroke="#b59d76"
        strokeWidth="4"
      />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <ellipse cx="259" cy={141 - i * 8} rx="27" ry="8" fill="#b79853" />
          <ellipse cx="259" cy={138 - i * 8} rx="27" ry="8" fill="#dac080" />
        </g>
      ))}
    </>
  ),
};
export function ProjectArt({
  kind = "planter",
  hero = false,
}: {
  kind?: string;
  hero?: boolean;
}) {
  if (!artwork[kind]) return <CircuitArt kind={kind} hero={hero} />;
  return (
    <svg
      viewBox="0 0 500 330"
      className={hero ? "hero-art" : "project-art"}
      aria-hidden="true"
    >
      <rect
        width="500"
        height="330"
        fill={
          ["planter", "propagation", "labels", "seedpots"].includes(kind)
            ? "#e4e9da"
            : ["cloths", "duster", "button", "patch"].includes(kind)
              ? "#e9e7dd"
              : "#f0e5d3"
        }
      />
      <circle cx="256" cy="156" r="126" fill="#faf7e9" opacity=".58" />
      <ellipse
        cx="252"
        cy="284"
        rx="160"
        ry="14"
        fill="#7c7659"
        opacity=".12"
      />
      {artwork[kind]}
      {["dividers", "caddy", "gift", "hand"].includes(kind) && tape}
    </svg>
  );
}
