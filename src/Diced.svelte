<script>
import {percentRank} from "./utils.js";

  import { Row, Col } from "sveltestrap";
  import { replay } from "./stores";

  export let homeTeam, awayTeam;
  let cumNetValues, actuals, homePercentile = 0.5, awayPercentile = 0.5;
  $: {
    cumNetValues = { actuals: {}, simulated: {} };
    actuals = $replay.rolls.map((roll) => ({
      team: roll.activeTeam.id,
      netValue: roll.valueWithDependents.singularValue - roll.expectedValue
    }));
    cumNetValues.actuals = accumulateNetValue(actuals);
    updatePercentiles();
  }

  function accumulateNetValue(values) {
    let dest = {};
    values.forEach((dataPoint) => {
      dest[dataPoint.team] =
        (dest[dataPoint.team] || 0) + dataPoint.netValue;
    });
    return dest;
  }
  function betterThan(team, percentile) {
    let qualifier = percentile < 0.25 ? "only " : "";
    let count = percentile * 100;
    if (count > 99) {
      count = count.toFixed(1);
    } else if (count < 10) {
      count = count.toFixed(2);
    } else {
      count = count.toFixed(0);
    }
    return `${team}'s rolls were better than ${qualifier}${count} in 100 games`;
  }
  function diced(team, percentile) {
    const sample = (items) => items[team.length % items.length];

    if (percentile > 0.985) {
      return "Nuffle's light shown down on them.";
    } else if (percentile > 0.9) {
      return sample([
        "Nuffle favored them.",
        "Game of Skill",
        "Just rolled Pows",
        "Blood Bowl is just like Chess",
        "They are vacationing in Maui, because those dice were hot!",
      ]);
    } else if (percentile > 0.8) {
      return sample([
        "Nuffle was generous.",
        "In blodge we trust",
        "Scatter don't matter",
        `Who has two thumbs and all the dice? ${team}`,
      ]);
    } else if (percentile < 0.01) {
      return sample([
        "An absolute, unmitigated dicing.",
        "Fuck this game.",
        "Rogered but good.",
      ]);
    } else if (percentile < 0.1) {
      return sample([
        "Quite a dicing.",
        `And 'lo, Nuffle did look down, and he said "No."`,
        "Because without hope, Nuffle would have nothing to destroy.",
        "They skipped their sacrifice to Nuffle",
        "Nuffle hated them",
        "They must be in the arctic cause those dice were frozen!",
        "The should try Necromantic next season, because their dice are dead!"
      ]);
    } else if (percentile < 0.3) {
      return sample([
        "A bit of a dicing.",
        "Why do I believe in blodge?",
        "Unfair dices! Unfair game!",
        "They couldn't roll their way out of a paper bag",
        `Who has two thumbs and none of the dice? ${team}`
      ]);
    } else {
      return "Variance, man. Variance.";
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function updatePercentiles() {
    await sleep(2000);
    var iteration = 0;
    for (var c = 0; c < 500; c++) {
      console.log("Computing 50 simulated games")
      for (var x = 0; x < 50; x++) {
        iteration++;
        let newValues = $replay.rolls.map((roll) => ({
          team: roll.activeTeam.id,
          netValue: roll.possibleOutcomes.sample() - roll.expectedValue,
        }));
        cumNetValues.simulated[iteration] = accumulateNetValue(newValues);
      }
      let oldHome = homePercentile, oldAway = awayPercentile;
      homePercentile = percentRank(
        Object.values(cumNetValues.simulated).map((cum) => cum[0]),
        cumNetValues.actuals[0]
      );
      awayPercentile = percentRank(
        Object.values(cumNetValues.simulated).map((cum) => cum[1]),
        cumNetValues.actuals[1]
      );
      console.log("Simulation iteration complete", {
        totalGames: c * 50,
        homeDelta: Math.abs(homePercentile - oldHome),
        awayDelta: Math.abs(awayPercentile - oldAway)
      });
      if (c > 10 && Math.abs(homePercentile - oldHome) < 0.001 && Math.abs(awayPercentile - oldAway) < 0.001) {
        return;
      }

      await sleep(100);
    }

  }
</script>

<div class="diced">
  <Row>
    <Col>
      <div class="home">
        <p>
          {betterThan(homeTeam, homePercentile)}<br />
          {diced(homeTeam, homePercentile)}
        </p>
      </div>
    </Col>
    <Col>
      <div class="away">
        <p>
          {betterThan(awayTeam, awayPercentile)}<br />
          {diced(awayTeam, awayPercentile)}
        </p>
      </div>
    </Col>
  </Row>
</div>

<style>
  .diced {
    font-size: large;
    font-weight: bold;
    text-align: center;
  }
  .home {
    color: var(--team0-color-8);
  }

  .away {
    color: var(--team1-color-8);
  }
</style>
