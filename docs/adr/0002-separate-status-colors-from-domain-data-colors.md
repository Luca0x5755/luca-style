Status: Accepted

# Separate status colors from domain data colors

Shared components use semantic color roles for success, warning and error. These roles keep their meanings across projects and are accompanied by text or an icon. A project's data colors, such as a trading product's red and green signals, are defined separately within that project. Semantic colors may be tuned to harmonize with the selected palette without changing their meaning.

We considered using the same red and green tokens for interface status and business data. That would reduce the number of tokens, but a red trading signal could be mistaken for an interface error, and a green signal for a successful operation. Keeping the roles separate adds tokens while preserving meaning.
