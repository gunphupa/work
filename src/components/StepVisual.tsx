import { useId, type ReactNode } from "react";
import { useLanguage } from "../i18n";
import type { Project } from "../domain/schema";

const paper = "#e7c996",
  ink = "#304e3e",
  green = "#8fba80",
  blue = "#a7d1df",
  cloth = "#c9b6d9";
function Box({
  x = 80,
  y = 65,
  w = 310,
  h = 140,
  fill = paper,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  fill?: string;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      fill={fill}
      stroke={ink}
      strokeWidth={3}
    />
  );
}
function Line({
  d,
  dash = false,
  color = ink,
}: {
  d: string;
  dash?: boolean;
  color?: string;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeDasharray={dash ? "7 5" : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
function Label({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fill={ink}
      fontSize={18}
      fontWeight={600}
      textAnchor="middle"
      stroke="none"
    >
      {children}
    </text>
  );
}
function Arrow({
  x = 230,
  y = 115,
  down = false,
}: {
  x?: number;
  y?: number;
  down?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${down ? 90 : 0})`}>
      <Line d="M-25 0H25M15 -10L25 0L15 10" />
    </g>
  );
}
function Jar({
  x = 160,
  water = false,
  plant = false,
  roots = false,
}: {
  x?: number;
  water?: boolean;
  plant?: boolean;
  roots?: boolean;
}) {
  return (
    <g>
      <Box x={x} y={85} w={110} h={130} fill="#edf3ee" />
      {water && <path d={`M${x + 3} 145h104v64H${x + 3}Z`} fill={blue} />}
      <Line d={`M${x - 4} 86h118`} />
      {plant && (
        <>
          <Line d={`M${x + 55} 157V40`} />
          <path
            d={`M${x + 55} 76q-55 0-42-35 38 0 42 35m0-18q12-35 40-21-9 30-40 21`}
            fill={green}
          />
          <circle cx={x + 55} cy={148} r={5} fill={ink} />
          {roots && (
            <Line
              d={`M${x + 55} 153q-20 12-12 36m12-36q20 15 15 35m-15-35v47`}
            />
          )}
        </>
      )}
    </g>
  );
}
function Stitches() {
  return (
    <path
      d="M140 84H340V190H140Z"
      fill="none"
      stroke={ink}
      strokeWidth={3}
      strokeDasharray="6 6"
    />
  );
}
function Shirt({
  bag = false,
  fringe = false,
}: {
  bag?: boolean;
  fringe?: boolean;
}) {
  return (
    <g>
      <path
        d={
          bag
            ? "M155 60L190 45V90H275V45L310 60V220H155Z"
            : "M155 60L195 45Q230 90 270 45L310 60L355 100L320 135L305 119V220H160V119L145 135L105 100Z"
        }
        fill={cloth}
        stroke={ink}
        strokeWidth={3}
      />
      {fringe &&
        Array.from({ length: 7 }, (_, n) => (
          <Line key={n} d={`M${165 + n * 22} 175V220`} />
        ))}
    </g>
  );
}
function HouseholdDiagram({ id, step: i }: { id: string; step: number }) {
  const { t } = useLanguage();
  switch (id) {
    case "drawer-dividers":
      return (
        <>
          <Box />
          {i === 0 ? (
            <>
              <Line d="M80 225H390M80 215v20M390 215v20" />
              <Label x={235} y={250}>
                {t("ความกว้าง", "Width")}
              </Label>
              <Line d="M235 65V205M80 135H390" dash />
            </>
          ) : i === 1 ? (
            <>
              <Box x={110} y={90} w={250} h={35} />
              <Box x={110} y={155} w={220} h={35} />
              <Line d="M235 90v18M220 190v-18" />
            </>
          ) : (
            <>
              <Line d="M235 65V205M80 135H390" />
              {i === 2 ? (
                <>
                  <Arrow x={190} y={105} />
                  <Arrow x={270} y={166} />
                </>
              ) : (
                <>
                  <circle cx={155} cy={100} r={18} fill={cloth} />
                  <rect
                    x={275}
                    y={153}
                    width={65}
                    height={20}
                    rx={5}
                    fill={green}
                  />
                  <Arrow x={425} y={130} down />
                </>
              )}
            </>
          )}
        </>
      );
    case "desk-caddy":
      return (
        <>
          <Box x={75} y={190} w={330} h={30} />
          {[115, 215, 315].map((x) => (
            <g key={x}>
              <Box x={x} y={70} w={65} h={125} />
              <ellipse
                cx={x + 32}
                cy={70}
                rx={32}
                ry={12}
                fill="#fffaf0"
                stroke={ink}
                strokeWidth={3}
              />
              {i > 0 && (
                <>
                  <Line d={`M${x} 175l-16 20h97l-16-20`} />
                  {i === 1 && (
                    <Label x={x + 32} y={243}>
                      1 cm
                    </Label>
                  )}
                </>
              )}
              {i > 1 && (
                <path d={`M${x - 9} 198h84`} stroke={blue} strokeWidth={12} />
              )}{" "}
              {i === 3 && <Line d={`M${x + 25} 80l-8-48m32 48 8-35`} />}
            </g>
          ))}
        </>
      );
    case "cable-rolls":
      return (
        <>
          {[110, 235, 360].map((x, n) => (
            <g key={x}>
              {i === 0 ? (
                <>
                  <Line d={`M${x - 30} 190q-35-100 0-100t30 100`} />
                  <Box x={x - 38} y={182} w={18} h={25} fill={blue} />
                  <Box x={x + 22} y={182} w={18} h={25} fill={blue} />
                </>
              ) : (
                <>
                  <ellipse
                    cx={x}
                    cy={143}
                    rx={48}
                    ry={65}
                    fill="none"
                    stroke={ink}
                    strokeWidth={5}
                  />
                  <Box x={x - 38} y={118} w={76} h={52} />
                  {i === 2 && (
                    <Label x={x} y={151}>
                      {["USB", "USB-C", "HDMI"][n]}
                    </Label>
                  )}
                </>
              )}
            </g>
          ))}
        </>
      );
    case "jar-storage":
      return (
        <>
          {[80, 240].map((x, n) => (
            <g key={x}>
              <Jar x={x} />
              {i > 0 &&
                [0, 1, 2, 3].map((k) => (
                  <circle
                    key={k}
                    cx={x + 25 + (k % 2) * 50}
                    cy={140 + Math.floor(k / 2) * 45}
                    r={13}
                    fill={n ? cloth : green}
                    stroke={ink}
                  />
                ))}
              {i === 2 && <Box x={x + 15} y={100} w={80} h={25} fill="#fff" />}
            </g>
          ))}
          {i === 0 && <Line d="M394 130l13 13 27-35" />}
        </>
      );
    case "phone-stand":
      return (
        <>
          {[110, 245].map((x) => (
            <g key={x}>
              <path
                d={`M${x} 200h110L${x + 80} 70Z`}
                fill={paper}
                stroke={ink}
                strokeWidth={3}
              />
              {i > 0 && <Line d={`M${x + 12} 200v-20h15v20`} />}
            </g>
          ))}
          {i === 0 ? (
            <>
              <Label x={162} y={232}>
                14 cm
              </Label>
              <Label x={208} y={120}>
                10 cm
              </Label>
            </>
          ) : i === 1 ? (
            <Label x={235} y={240}>
              1 cm
            </Label>
          ) : (
            <>
              <Line d="M165 133l135 0M191 185h134" />
              {i === 3 && (
                <rect
                  x={160}
                  y={48}
                  width={140}
                  height={150}
                  rx={9}
                  fill={blue}
                  stroke={ink}
                  strokeWidth={4}
                  transform="rotate(17 230 130)"
                />
              )}
            </>
          )}
        </>
      );
    case "cleaning-cloths":
      return (
        <>
          {i === 0 ? (
            <Shirt />
          ) : (
            <>
              {[100, 265].map((x) => (
                <Box
                  key={x}
                  x={x}
                  y={75}
                  w={115}
                  h={115}
                  fill={x === 100 ? cloth : blue}
                />
              ))}
              {i === 1 ? (
                <>
                  <Label x={156} y={220}>
                    20 × 20 cm
                  </Label>
                  <Line d="M90 63H225V200" dash />
                </>
              ) : i === 2 ? (
                <Arrow x={240} y={130} />
              ) : (
                <Line d="M235 55v165" dash />
              )}
            </>
          )}
        </>
      );
    case "sock-duster":
      return (
        <>
          <path
            d="M195 55h80v113l-70 51q-35 17-52-10t14-45l28-17Z"
            fill={cloth}
            stroke={ink}
            strokeWidth={3}
          />
          {i === 0 ? (
            <Line d="M315 135l18 18 38-47" />
          ) : (
            <>
              <Box x={60} y={224} w={350} h={14} />
              {i === 1 ? (
                <Arrow x={318} y={183} />
              ) : (
                <>
                  <Arrow x={365} y={80} down />
                  <Arrow x={110} y={185} />
                </>
              )}
            </>
          )}
        </>
      );
    case "lint-roller":
      return (
        <>
          <Box x={85} y={95} w={310} h={85} />
          {i > 0 && (
            <>
              <Box x={145} y={88} w={190} h={99} fill={blue} />
              <Line
                d="M163 94v83m26-83v83m26-83v83m26-83v83m26-83v83m26-83v83m26-83v83"
                dash
              />
            </>
          )}
          {i === 0 ? (
            <>
              <circle
                cx={230}
                cy={138}
                r={30}
                fill="#fff"
                stroke={ink}
                strokeWidth={12}
              />
              <Box x={115} y={210} w={110} h={20} fill={cloth} />
            </>
          ) : i === 1 ? (
            <Arrow x={230} y={60} />
          ) : (
            <>
              <Box x={110} y={220} w={245} h={20} fill={cloth} />
              <Arrow x={230} y={60} />
            </>
          )}
        </>
      );
    case "sew-button":
      return (
        <>
          <Box x={90} y={60} w={290} h={160} fill={cloth} />
          <circle
            cx={230}
            cy={133}
            r={47}
            fill={paper}
            stroke={ink}
            strokeWidth={3}
          />
          {[
            [-15, -15],
            [15, -15],
            [-15, 15],
            [15, 15],
          ].map(([x, y]) => (
            <circle
              key={`${x}:${y}`}
              cx={230 + x}
              cy={133 + y}
              r={5}
              fill={ink}
            />
          ))}
          {i === 0 ? (
            <Line d="M60 78l75 24q70-32 80 16" />
          ) : i === 1 ? (
            <>
              <Line d="M215 118h30m-30 30h30" />
              <Label x={230} y={247}>
                5–6 ×
              </Label>
            </>
          ) : i === 2 ? (
            <>
              <path
                d="M210 130q0-35 32-10t-12 34q-24-5 2-28"
                fill="none"
                stroke={ink}
                strokeWidth={4}
              />
              <Label x={230} y={247}>
                ↻
              </Label>
            </>
          ) : (
            <>
              <Arrow x={335} y={133} />
              <Label x={230} y={247}>
                5 ×
              </Label>
            </>
          )}
        </>
      );
    case "fabric-patch":
      return (
        <>
          <Box x={80} y={45} w={330} h={190} fill={cloth} />
          {i === 0 ? (
            <>
              <Line d="M193 110l20 20 15-22 17 30 28-8" />
              <path
                d="M140 84H340V190H140Z"
                fill="none"
                stroke={ink}
                strokeDasharray="7 5"
              />
              <Label x={300} y={175}>
                ≥ 2 cm
              </Label>
            </>
          ) : (
            <>
              <Box x={128} y={72} w={224} h={130} fill={blue} />
              {i === 1 ? (
                <>
                  <Line d="M140 84H340V190H140Z" />
                  <Label x={230} y={150}>
                    5 mm
                  </Label>
                </>
              ) : (
                <Stitches />
              )}
              {i === 3 && (
                <>
                  <Arrow x={90} y={135} />
                  <Arrow x={390} y={135} />
                </>
              )}
            </>
          )}
        </>
      );
    case "zipper-pull":
      return (
        <>
          <Box x={70} y={70} w={330} h={150} fill={cloth} />
          <Line d="M85 153H380M85 167H380" />
          {Array.from({ length: 14 }, (_, n) => (
            <Line key={n} d={`M${88 + n * 22} 145v30`} />
          ))}
          <Box x={190} y={135} w={65} h={48} fill={blue} />
          <circle
            cx={220}
            cy={127}
            r={11}
            fill="none"
            stroke={ink}
            strokeWidth={5}
          />
          {i > 0 && (
            <>
              <Line d="M220 127q-90-70-18-64t18 64" />
              {i === 1 ? (
                <Arrow x={288} y={78} />
              ) : (
                <>
                  <Line d="M220 119l-26-34m26 34 18-39" />
                  <Arrow x={316} y={119} />
                  <Label x={330} y={218}>
                    5 ×
                  </Label>
                </>
              )}
            </>
          )}
        </>
      );
    case "tshirt-tote":
      return (
        <>
          <Shirt bag={true} fringe={i === 1 || i === 2} />
          {i === 0 ? (
            <Label x={230} y={32}>
              ≥ 5 cm
            </Label>
          ) : i === 1 ? (
            <>
              <Label x={355} y={205}>
                8 cm
              </Label>
              <Label x={230} y={249}>
                2 cm
              </Label>
            </>
          ) : i === 2 ? (
            <>
              {[175, 197, 219, 241, 263, 285].map((x) => (
                <Line key={x} d={`M${x - 6} 206l12 12m-12 0 12-12`} />
              ))}
            </>
          ) : (
            <>
              <Box x={188} y={145} w={86} h={50} fill={green} />
              <Arrow x={352} y={143} down />
            </>
          )}
        </>
      );
    case "cereal-gift-bag":
      return (
        <>
          <Box x={135} y={75} w={190} h={150} fill={i > 0 ? green : paper} />
          <path
            d="M135 75l30-40h130l30 40"
            fill={paper}
            stroke={ink}
            strokeWidth={3}
          />
          {i === 0 ? (
            <>
              <Box x={175} y={110} w={110} h={70} fill={cloth} />
              <Arrow x={230} y={20} down />
            </>
          ) : i === 1 ? (
            <>
              <Line d="M145 80v133h170" dash />
              <Arrow x={360} y={145} />
            </>
          ) : (
            <>
              <Box x={170} y={105} w={120} h={70} fill="#fff" />
              <Label x={230} y={150}>
                ♡
              </Label>
              <Line d="M190 75h80" color={blue} />
            </>
          )}
        </>
      );
    case "woven-coaster":
      return (
        <>
          {[0, 1, 2, 3, 4].map((n) => (
            <Box key={n} x={125 + n * 37} y={50} w={25} h={175} fill={paper} />
          ))}
          {i === 0 ? (
            <Label x={235} y={251}>
              1 × 18 cm
            </Label>
          ) : i === 1 ? (
            <Line d="M110 58h215" color={blue} />
          ) : (
            <>
              {[0, 1, 2, 3, 4].map((n) => (
                <g key={n}>
                  <Box x={115} y={65 + n * 30} w={205} h={17} fill={green} />
                  {[0, 1, 2, 3, 4]
                    .filter((m) => (m + n) % 2 === 0)
                    .map((m) => (
                      <rect
                        key={m}
                        x={125 + m * 37}
                        y={65 + n * 30}
                        width={25}
                        height={17}
                        fill={paper}
                      />
                    ))}
                </g>
              ))}
              {i === 3 && (
                <circle
                  cx={215}
                  cy={134}
                  r={40}
                  fill="#fff"
                  fillOpacity={0.85}
                  stroke={ink}
                  strokeWidth={3}
                />
              )}
            </>
          )}
        </>
      );
    case "bottle-planter":
      return (
        <>
          <path
            d="M155 125h165v112H155Z"
            fill={i === 3 ? blue : "#edf3ee"}
            stroke={ink}
            strokeWidth={3}
          />
          <path
            d="M151 85h173l-65 77v20h-40v-20Z"
            fill={i > 1 ? paper : "#edf3ee"}
            stroke={ink}
            strokeWidth={3}
          />
          {i === 0 ? (
            <>
              <Line d="M145 105h190" dash />
              <Arrow x={357} y={124} down />
            </>
          ) : (
            <>
              {/* Wick crosses the cap into the reservoir. */}
              <Line d="M235 118v65q-18 20 0 42" color="#795638" />
              {i > 1 && (
                <>
                  <Line d="M235 123V35" />
                  <path
                    d="M235 66q-42 0-37-27 35 0 37 27m0-9q16-32 41-16-11 25-41 16"
                    fill={green}
                  />
                </>
              )}
              {i === 3 && (
                <>
                  <Line d="M151 125h173" dash />
                  <Label x={390} y={125}>
                    ≤ 1 mm
                  </Label>
                  <Line d="M326 120h15" />
                </>
              )}
            </>
          )}
        </>
      );
    case "seed-pots":
      return (
        <>
          {[105, 235].map((x, n) => (
            <g key={x}>
              <Box x={x} y={70} w={85} h={130} />
              {i === 0 ? (
                <Line d={`M${x} 164l42 30 43-30m-43-10v43`} />
              ) : (
                <>
                  <ellipse cx={x + 42} cy={80} rx={36} ry={13} fill="#896c4b" />
                  {i > 1 && <circle cx={x + 42} cy={80} r={4} fill={ink} />}
                  {i === 3 && (
                    <>
                      <Line d={`M${x + 42} 80V38`} />
                      <path
                        d={`M${x + 42} 56q-20 0-21-17 21-3 21 17m0-6q7-18 24-15-3 17-24 15`}
                        fill={green}
                      />
                    </>
                  )}
                  <Label x={x + 42} y={145}>
                    {n + 1}
                  </Label>
                </>
              )}
            </g>
          ))}
          <Box x={75} y={203} w={280} h={18} fill={blue} />
        </>
      );
    case "propagation-jar":
      return (
        <>
          <Jar water={i > 0} plant roots={i === 3} />
          {i === 0 ? (
            <>
              <circle
                cx={215}
                cy={148}
                r={14}
                fill="none"
                stroke={ink}
                strokeDasharray="5 4"
              />
              <Arrow x={300} y={148} />
            </>
          ) : i === 1 ? (
            <Line d="M295 145h55" />
          ) : i === 2 ? (
            <>
              <circle cx={375} cy={50} r={23} fill={paper} />
              <Line d="M330 60l-35 30" dash />
            </>
          ) : (
            <>
              <Line d="M302 154v50m-7-50h14m-14 50h14" />
              <Label x={340} y={190}>
                cm
              </Label>
            </>
          )}
        </>
      );
    case "plant-labels":
      return (
        <>
          {[120, 210, 300].map((x, n) => (
            <g key={x}>
              <Box x={x} y={45} w={45} h={180} fill={paper} />
              {i > 0 && (
                <>
                  <Line d={`M${x + 10} 70h25m-25 20h25m-25 20h25`} />
                  <Label x={x + 22} y={140}>
                    {n + 1}
                  </Label>
                </>
              )}
            </g>
          ))}
          {i === 2 && (
            <>
              <Box x={80} y={172} w={320} h={65} />
              <Line d="M255 193V135" />
              <path d="M255 165q-35-8-25-25 22 0 25 25" fill={green} />
            </>
          )}
        </>
      );
    case "marble-maze":
      return (
        <>
          <Box x={80} y={50} w={330} h={185} />
          {i === 0 ? (
            <>
              <Line d="M115 80h245v50H130v65h245" dash />
              <circle cx={112} cy={85} r={11} fill={blue} />
            </>
          ) : i === 1 ? (
            <>
              <Box x={115} y={80} w={235} h={30} />
              <Line d="M115 110l-12 15h260l-13-15" />
              <Label x={232} y={175}>
                2 cm
              </Label>
            </>
          ) : (
            <>
              <Line
                d={
                  i === 3
                    ? "M125 95h215v50H125v45h140"
                    : "M125 95h245v50H125v45h245"
                }
              />
              <circle cx={112} cy={78} r={11} fill={blue} />
              <circle cx={381} cy={210} r={10} fill={green} />
              <Arrow x={440} y={150} down />
              {i === 3 && (
                <Label x={235} y={258}>
                  5 ×
                </Label>
              )}
            </>
          )}
        </>
      );
    case "moving-hand":
      return (
        <>
          <path
            d="M190 232V190L130 140Q118 119 135 113L180 141V57Q180 41 195 43L209 123V38Q218 19 231 35L240 119V44Q253 28 262 44L270 128V71Q284 54 293 76L302 164 276 205V232Z"
            fill={paper}
            stroke={ink}
            strokeWidth={3}
          />
          {i > 0 && (
            <>
              <Line
                d="M184 100h19m9-10h22m13 8h17m11 9h21m-126 54 11-11"
                dash
              />
              {i > 1 &&
                [195, 225, 254, 284].map((x, n) => (
                  <g key={x}>
                    <Line d={`M${x} ${58 + n * 7}v24m0 29v26`} color={blue} />
                    {i === 3 && (
                      <Line d={`M${x} ${56 + n * 7}v79L235 204v40`} />
                    )}
                  </g>
                ))}
            </>
          )}
          {i === 3 && <Arrow x={344} y={175} down />}
        </>
      );
    case "paper-bridge":
      return (
        <>
          <Box x={65} y={140} w={100} h={80} />
          <Box x={310} y={140} w={100} h={80} />
          {i === 0 ? (
            <>
              <Line d="M165 180h145m-145-8v16m145-16v16" />
              <Label x={238} y={211}>
                10 cm
              </Label>
            </>
          ) : (
            <>
              <path
                d={
                  i < 2
                    ? "M105 138H370"
                    : "M105 138H370M105 126H370M105 114H370M105 102H370M105 138l-8-6 8-6-8-6 8-6-8-6 8-6M370 138l-8-6 8-6-8-6 8-6-8-6 8-6"
                }
                fill="none"
                stroke={ink}
                strokeWidth={4}
              />
              {i !== 2 && (
                <>
                  <ellipse
                    cx={240}
                    cy={90}
                    rx={23}
                    ry={7}
                    fill={paper}
                    stroke={ink}
                    strokeWidth={3}
                  />
                  <Arrow x={240} y={51} down />
                </>
              )}
            </>
          )}
        </>
      );
    case "straw-rocket":
      return (
        <>
          <rect
            x={75}
            y={111}
            width={320}
            height={17}
            rx={5}
            fill={blue}
            stroke={ink}
            strokeWidth={2}
          />
          <path
            d={i === 0 ? "M190 90h150v60H190Z" : "M190 90h150l45 30-45 30H190Z"}
            fill={paper}
            stroke={ink}
            strokeWidth={3}
          />
          {i > 0 && (
            <>
              <path
                d="M195 92l-10-40 67 40m-57 56-10 40 67-40"
                fill={green}
                stroke={ink}
                strokeWidth={3}
              />
              {i > 1 && <Arrow x={430} y={120} />}
            </>
          )}
          {i === 3 && (
            <>
              <Line d="M95 220H400" />
              <Label x={240} y={250}>
                cm / m
              </Label>
            </>
          )}
        </>
      );
    default:
      return null;
  }
}
export function StepVisual({
  project: p,
  index,
}: {
  project: Project;
  index: number;
}) {
  const { t } = useLanguage();
  const id = useId();
  if (p.category === "electronics")
    return (
      <figure className="step-visual electronics-visual">
        {index === 0 ? (
          <>
            <strong>
              {t("เตรียมก่อนเสียบ USB", "Prepare before connecting USB")}
            </strong>
            <div className="visual-parts">
              {p.requirements.map((r) => (
                <span key={r.id}>
                  {r.quantity} × {r.label}
                </span>
              ))}
            </div>
          </>
        ) : index === 1 ? (
          <>
            <strong>{t("แผนผังจุดเชื่อมต่อ", "Connection map")}</strong>
            {p.wiring?.length ? (
              <div className="visual-wires">
                {p.wiring.map((w, i) => (
                  <div key={i}>
                    <span>{w.from}</span>
                    <b aria-hidden="true">→</b>
                    <span>{w.to}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="visual-parts">
                <span>USB</span>
                <span>Arduino UNO R3</span>
                <span>{t("อุปกรณ์บนบอร์ด", "Onboard components")}</span>
              </div>
            )}
            <p>
              {t(
                "ถอด USB ก่อนต่อสาย ผังนี้ไม่ใช่ตำแหน่งรูเบรดบอร์ด",
                "Disconnect USB before wiring. This map does not show breadboard hole positions.",
              )}
            </p>
          </>
        ) : index === 2 ? (
          <>
            <strong>{t("ลำดับใน Arduino IDE", "Arduino IDE sequence")}</strong>
            <ol className="upload-sequence">
              <li>{t("เลือก UNO R3 และพอร์ต", "Select UNO R3 and port")}</li>
              <li>{t("วางโค้ดจากคู่มือนี้", "Paste this guide’s sketch")}</li>
              <li>Verify → Upload</li>
            </ol>
          </>
        ) : (
          <>
            <strong>
              {t("สังเกต → วัด → บันทึก", "Observe → measure → record")}
            </strong>
            <p>{p.test.instruction}</p>
            <div className="measurement-example">
              <span>{t("ครั้งที่", "Trial")}</span>
              <span>
                {t("สิ่งที่วัดได้", "Observed result")} ({p.test.unit})
              </span>
              <span>1</span>
              <span>—</span>
              <span>2</span>
              <span>—</span>
            </div>
          </>
        )}
        <figcaption>
          {t(
            "ภาพสรุปขั้นตอน อ่านคำแนะนำและตรวจอุปกรณ์จริงควบคู่กัน",
            "Step summary. Follow the instructions and check your actual hardware.",
          )}
        </figcaption>
      </figure>
    );
  return (
    <figure className="step-visual">
      <svg viewBox="0 0 480 280" role="img" aria-labelledby={id}>
        <title id={id}>
          {t(
            `ภาพประกอบขั้นตอน ${index + 1}: ${p.steps[index].title}`,
            `Step ${index + 1} diagram: ${p.steps[index].title}`,
          )}
        </title>
        <HouseholdDiagram id={p.id} step={index} />
      </svg>
      <figcaption>
        {t(
          "ภาพประกอบแนวคิด ไม่ได้แสดงตามสัดส่วนจริง ใช้ขนาดจากคำแนะนำ",
          "Concept diagram, not to scale. Use the dimensions in the instructions.",
        )}
      </figcaption>
    </figure>
  );
}
