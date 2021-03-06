<script>
  import FixedRatio from "./FixedRatio.svelte";
  import FlexGrid from "./FlexGrid.svelte";

  import Player from "./Player.svelte";
  import { translateStringNumberList } from "../replay-utils.js";
  import { SKILL_CSS, SITUATION, Casualties, STAR_NAMES } from "../constants.js";
  import he from "he";

  export let player, players;
  let pitchPlayer, name, color, skills, cas;
  const colorRE = /\[colour='([0-9a-f]{8})'\]/i;
  $: {
    pitchPlayer = players[player];
    name = he.decode(pitchPlayer.data.Data.Name.toString().replace(colorRE, ""));
    name = STAR_NAMES[name] || name;
    let colorMatch = pitchPlayer.data.Data.Name.toString().match(colorRE);
    color = colorMatch ? `#${colorMatch[1].slice(2, 8)}` : "var(--gray-0)";
    skills = translateStringNumberList(pitchPlayer.data.Data.ListSkills);

    if (pitchPlayer.data.Situation >= SITUATION.Casualty) {
      if (pitchPlayer.data.Situation === SITUATION.Casualty) {
        cas =
          Casualties[
            Math.max(...translateStringNumberList(pitchPlayer.data.ListCasualties))
          ].icon;
      } else {
        cas = "Expelled";
      }
    } else {
      cas = null;
    }
  }
</script>

{#if player}
  <div class="player-card">
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 207 317"
      preserveAspectRatio="xMinYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
    >
      <image href="/images/card.png" height="100%" />
      <text class="name" x="18" y="36" style={`fill: ${color}`}>{name}</text>
      <text class="stat mv" x="18" y="75" text-anchor="middle">MV</text>
      <text class="stat mv value" x="18" y="109" text-anchor="middle"
        >{pitchPlayer.data.Data.Ma}</text
      >
      <text class="stat st" x="18" y="140" text-anchor="middle">ST</text>
      <text class="stat st value" x="18" y="174" text-anchor="middle"
        >{pitchPlayer.data.Data.St}</text
      >
      <text class="stat ag" x="18" y="204" text-anchor="middle">AG</text>
      <text class="stat ag value" x="18" y="238" text-anchor="middle"
        >{pitchPlayer.data.Data.Ag}</text
      >
      <text class="stat av" x="18" y="273" text-anchor="middle">AV</text>
      <text class="stat av value" x="18" y="304" text-anchor="middle"
        >{pitchPlayer.data.Data.Av}</text
      >
    </svg>
    <div class="icon-frame">
      <FixedRatio>
        <div class="icon">
          <Player {...pitchPlayer} />
        </div>
      </FixedRatio>
    </div>
    {#if cas}
      <div class="cas">
        <FixedRatio>
          <img src={`/images/skills/${cas}.png`} alt={cas} />
        </FixedRatio>
      </div>
    {/if}
    <div class="skills-frame">
      <FlexGrid width={4} height={3}>
        {#each skills as skill}
          <div class={`sprite skill ${SKILL_CSS[skill]}`} />
        {/each}
      </FlexGrid>
    </div>
  </div>
{/if}

<style>
  .player-card {
    font-family: "Nuffle";
    position: relative;
    z-index: 9;
  }
  .stat.value {
    fill: var(--gray-0);
    font-size: 30px;
  }
  .stat {
    fill: var(--gray-3);
    font-size: 16px;
  }
  .name {
    font-size: 18px;
  }
  .icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }

  .icon-frame {
    position: absolute;
    top: 18%;
    left: 18%;
    width: 80%;
  }
  .stats {
    top: 17%;
    height: 83%;
    width: 18%;
    position: relative;
  }
  .player-data {
    background-image: url("/images/card.png");
    background-repeat: no-repeat;
    background-size: 100% 100%;
    width: 100%;
    height: 100%;
    position: relative;
  }

  .skills-frame {
    position: absolute;
    left: 20%;
    width: 76%;
    bottom: 10%;
  }
  .skill.sprite {
    height: 33%;
    flex: 0 0 25%;
    position: relative;
  }

  .cas {
    position: absolute;
    bottom: -5%;
    right: -5%;
    width: 40%;
    z-index: 10;
  }
  .cas img {
    width: 100%;
    height: 100%;
  }
</style>
