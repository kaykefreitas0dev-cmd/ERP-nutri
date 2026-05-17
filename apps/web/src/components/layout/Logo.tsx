import { type SVGProps } from "react";

/**
 * NutricoreLogoMark — folha estilizada com letra N integrada.
 *
 * Versão compacta (24x24) para sidebar colapsada. Usa `currentColor` para
 * herdar a cor do pai.
 */
export function NutricoreLogoMark({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Folha base — formato gota arredondada */}
      <path
        d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11z"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Letra N integrada (vista como nervura central) */}
      <path
        d="M9 16V9.5l6 6V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * NutricoreLogoFull — logomark + wordmark "NutriCore".
 *
 * Versão expandida (sidebar aberta, headers).
 */
export function NutricoreLogoFull({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 28"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Mark */}
      <g transform="translate(2 2)">
        <path
          d="M12 0C8 4 5 7 5 11a7 7 0 0 0 14 0c0-4-3-7-7-11z"
          fill="currentColor"
          fillOpacity="0.12"
        />
        <path
          d="M12 0C8 4 5 7 5 11a7 7 0 0 0 14 0c0-4-3-7-7-11z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 14V7.5l6 6V6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      {/* Wordmark "NutriCore" */}
      <text
        x="34"
        y="20"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="16"
        fontWeight="600"
        letterSpacing="-0.01em"
        fill="currentColor"
      >
        NutriCore
      </text>
    </svg>
  );
}
