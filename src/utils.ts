const COLOR = {
    LIGHT: {
        backgroundColor: "#F6F9FC",
        comment: "#788FA7",
        tableType: "#D5408C",
        tableName: "#805AD5",
        columnName: "#1A202C",
        columnProperty: "#DD6B21",
        columnType: "#805AD5",
        punctuation: "#393A34",
        text: "#1A202C",
    },
    DARK: {
        backgroundColor: "#1A202C",
        comment: "#718096",
        tableType: "#DF6FA8",
        tableName: "#9F83DF",
        columnName: "#E2E8F0",
        columnProperty: "#E68F57",
        columnType: "#9F83DF",
        punctuation: "#A0AEC0",
        text: "#E2E8F0",
    },
};

function getFormattedDateTimeString(dateTime: Date) {
    const formattedDate = `${dateTime.toLocaleDateString()} at ${dateTime.toLocaleTimeString(
        [],
        { hour: "numeric", minute: "numeric", timeZone: "UTC" },
    )} (UTC)`;

    return formattedDate;
}

function getHTMLStyles() {
    function getAllColorsInCss(object: typeof COLOR.LIGHT) {
        let css = "";
        for (const [key, value] of Object.entries(object)) {
            css += `--color-${key}: ${value};\n`;
        }
        return css;
    }
    return `
    <style>
        [data-theme="light"] {
            ${getAllColorsInCss(COLOR.LIGHT)}
        }
      
        [data-theme="dark"] {
            ${getAllColorsInCss(COLOR.DARK)}
        }

        .comment {
            color: var(--color-comment);
        }
        .tableType {
            color: var(--color-tableType);
        }
        .tableName {
            color: var(--color-tableName);
        }
        .columnName {
            color: var(--color-columnName);
        }
        .columnType {
            color: var(--color-columnType);
        }
        .columnProperty {
            color: var(--color-columnProperty);
        }
        .punctuation {
            color: var(--color-punctuation);
        }
        .text {
            color: var(--color-text);
        }
        .pre {
            background-color: var(--color-backgroundColor);
            overflow: auto;
            padding: 16px;
            padding-top: 0px;
            padding-bottom: 0px;
        }

        html, body, pre {
            margin: 0;
            font-family: monospace;
        }

        [data-tooltip] {
            position: relative;
            cursor: help;
            display: inline-block;
        }

        [data-tooltip]:before {
            left: 100%;
            top: -25%;
            margin-left: 12px;
            content: attr(data-tooltip);
            display: none;
            position: absolute;
            background: var(--color-comment);
            color: var(--color-backgroundColor);
            padding: 4px 8px;
            min-width: 100px;
            text-align: center;
            border-radius: 2px;
        }

        [data-tooltip]:hover:before {
            display: block;
            z-index: 50;
        }

    </style>`;
}

function getScript() {
    return `
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const html = document.querySelector("html");
            
            const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches === true;
            const defaultTheme = isSystemDark ? "dark" : "light";
            html.setAttribute("data-theme", defaultTheme);

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',({ matches }) => {
                if (matches) {
                    html.setAttribute("data-theme", "dark");
                } else {
                    html.setAttribute("data-theme", "light");
                }
            })

            const button = document.querySelector("[data-theme-toggle]");

            button.addEventListener("click", () => {
                const currentTheme = html.getAttribute("data-theme");
                const newTheme = currentTheme === "dark" ? "light" : "dark";
                
                // update theme attribute on HTML to switch theme in CSS
                html.setAttribute("data-theme", newTheme);
            });
        });
    </script>`;
}

function insertSpan(
    className: keyof typeof COLOR.LIGHT,
    text: string,
    fileType: "txt" | "html",
    tooltip?: string,
) {
    if (fileType === "txt") {
        return text;
    }
    let tooltipAttr = "";
    if (tooltip) {
        tooltipAttr = `data-tooltip="${tooltip}"`;
    }
    return `<span class="${className}" ${tooltipAttr}>${text}</span>`;
}

export { getFormattedDateTimeString, getHTMLStyles, insertSpan, getScript };
