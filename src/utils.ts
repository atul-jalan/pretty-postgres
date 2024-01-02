const COLOR = {
    LIGHT: {
        bgColor: "#F6F9FC",
        popperBgColor: "#E3ECF5",
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
        bgColor: "#1A202C",
        popperBgColor: "#2A3447",
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

function wrapElement(
    content: string,
    tag: string,
    attributes?: Record<string, string | boolean>,
) {
    let stringifiedAttributes = "";

    if (attributes) {
        const spacer = " ";

        for (const [key, value] of Object.entries(attributes)) {
            if (typeof value === "boolean") {
                stringifiedAttributes += `${spacer}${key}`;
            } else {
                stringifiedAttributes += `${spacer}${key}="${value}"`;
            }
        }
    }

    return `<${tag}${stringifiedAttributes}>${content}</${tag}>`;
}

function getHTMLStyles() {
    function getAllColorsInCss(object: typeof COLOR.LIGHT) {
        let css = "";
        for (const [key, value] of Object.entries(object)) {
            css += `--color-${key}: ${value};\n`;
        }
        return css;
    }

    const styles = `
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
    .bold {
        font-weight: 700;
    }
    .link {
        all: unset;
        text-decoration: underline;
        cursor: pointer;
    }
    .pre {
        background-color: var(--color-bgColor);
        overflow: auto;
        padding: 16px;
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
        top: -50%;
        margin-left: 12px;
        content: attr(data-tooltip);
        display: none;
        position: absolute;
        background: var(--color-popperBgColor);
        color: var(--color-text);
        padding: 8px;
        min-width: 100px;
        text-align: center;
        border-radius: 2px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        font-weight: 400;
    }

    [data-tooltip]:hover:before {
        display: block;
        z-index: 50;
    }
    `;

    return wrapElement(styles, "style");
}

function getScript() {
    const script = `
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
    `;

    return wrapElement(script, "script");
}

function wrapSpan(content: string, className: string, tooltip?: string) {
    const attributes: Record<string, string> = {
        class: className,
    };

    if (tooltip) {
        attributes["data-tooltip"] = tooltip;
    }

    return wrapElement(content, "span", attributes);
}

const toggleThemeButton = wrapElement("Toggle theme", "button", {
    type: "button",
    "data-theme-toggle": true,
    "aria-label": "Change color theme",
    style: "position: absolute; top: 16px; right: 16px; border-style: none; border-radius: 2px; background-color: var(--color-comment); color: var(--color-bgColor); padding: 8px; padding-left: 16px; padding-right: 16px; cursor: pointer;",
});

function splitString(input: string, maxLength: number) {
    let words = input.split(" ");
    let result = [];
    let currentString = "";

    for (let i = 0; i < words.length; i++) {
        if ((currentString + words[i]).length <= maxLength) {
            currentString += " " + words[i];
        } else {
            result.push(currentString.trim());
            currentString = words[i];
        }
    }

    result.push(currentString.trim());

    return result;
}

export {
    getFormattedDateTimeString,
    getHTMLStyles,
    wrapSpan,
    getScript,
    wrapElement,
    toggleThemeButton,
    splitString,
};
