#!/usr/bin/env python3
"""Apply the MC SERVER AFK policy to the pinned Essential Commands 26.x source."""
from pathlib import Path

path = Path("src/main/java/com/fibermc/essentialcommands/playerdata/PlayerData.java")
source = path.read_text(encoding="utf-8")

def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"Patch precondition failed for {label}: expected 1 match, found {count}")
    source = source.replace(old, new, 1)

replace_once(
    "import net.minecraft.server.level.ServerPlayer;\n",
    "import net.minecraft.server.level.ServerPlayer;\n"
    "import net.minecraft.server.permissions.Permission;\n"
    "import net.minecraft.server.permissions.PermissionLevel;\n",
    "permission imports",
)

replace_once(
    "    private boolean hasMovedThisTick;\n",
    "    private boolean hasMovedThisTick;\n"
    "    private boolean afkKickWarningSent;\n"
    "    private static final int AFK_KICK_WARNING_TICKS = 20 * 60 * 25;\n"
    "    private static final int AFK_KICK_TICKS = 20 * 60 * 30;\n",
    "AFK kick state",
)

replace_once(
    "    public void onTickEnd() {\n"
    "        var ticks = player.level().getServer().getTickCount();\n"
    "        var currentPos = player.position();\n"
    "        hasMovedThisTick = !this.lastTickPos.equals(currentPos);\n"
    "        if (hasMovedThisTick) {\n"
    "            lastMovedTick = ticks;\n"
    "        }\n",
    "    private boolean hasAfkKickExemption() {\n"
    "        var source = player.createCommandSourceStack();\n"
    "        if (source.permissions().hasPermission(new Permission.HasCommandLevel(PermissionLevel.GAMEMASTERS))) {\n"
    "            return true;\n"
    "        }\n"
    "        return CONFIG.USE_PERMISSIONS_API\n"
    "            && ECPerms.check(source, ECPerms.of(\"afk.kickexempt\"), 5);\n"
    "    }\n\n"
    "    public void onTickEnd() {\n"
    "        var ticks = player.level().getServer().getTickCount();\n"
    "        var currentPos = player.position();\n"
    "        hasMovedThisTick = !this.lastTickPos.equals(currentPos);\n"
    "        if (hasMovedThisTick) {\n"
    "            lastMovedTick = ticks;\n"
    "            afkKickWarningSent = false;\n"
    "        }\n"
    "        if (!hasAfkKickExemption()) {\n"
    "            int idleTicks = ticks - Math.max(lastMovedTick, lastActionTick);\n"
    "            if (idleTicks >= AFK_KICK_WARNING_TICKS && !afkKickWarningSent) {\n"
    "                player.sendSystemMessage(Component.literal(\"You have been inactive for 25 minutes. You will be disconnected after 30 minutes of inactivity. Move or interact to stay connected.\"));\n"
    "                afkKickWarningSent = true;\n"
    "            }\n"
    "            if (idleTicks >= AFK_KICK_TICKS) {\n"
    "                player.connection.disconnect(Component.literal(\"Disconnected for 30 minutes of inactivity.\"));\n"
    "                return;\n"
    "            }\n"
    "        } else {\n"
    "            afkKickWarningSent = false;\n"
    "        }\n",
    "AFK warning and kick",
)

replace_once(
    "    public void updateLastActionTick() {\n"
    "        this.lastActionTick = player.level().getServer().getTickCount();\n"
    "    }",
    "    public void updateLastActionTick() {\n"
    "        this.lastActionTick = player.level().getServer().getTickCount();\n"
    "        this.afkKickWarningSent = false;\n"
    "    }",
    "reset warning on activity",
)

path.write_text(source, encoding="utf-8")
print("AFK policy patch applied: warning=25m, kick=30m, operator/LuckPerms exemption.")
