import {
  ATTACKER_DOWN,
  PUSH,
  BOTH_DOWN,
  DEFENDER_STUMBLES,
  DEFENDER_DOWN,
  TWO_DIE_BLOCK,
  BLOCK,
} from "./dice.js";
import { SKILL_NAME, SKILL, SITUATION } from "./constants.js";

// TODO: Switch over to using dice.js for better clarity

function ensureList(objOrList) {
  if (objOrList && objOrList.length) {
    return objOrList;
  } else if (objOrList) {
    return [objOrList];
  } else {
    return [];
  }
}

function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

class Player {
  team;
  playerState;

  constructor(team, playerState) {
    this.team = team;
    this.playerState = playerState;
    this.id = this.playerState.data.id;
    this.name = this.playerState.data.name;
    this.cell = this.playerState.cell;
    this.situation = this.playerState.situation;
    this.canAct =
      this.playerState.canact == 1 && this.situation === SITUATION.Active;
  }

  get skills() {
    return Roll.translateStringNumberList(this.playerState.data.listskills);
  }
}

class Team {
  teamState;
  constructor(teamState) {
    this.teamState = teamState;
    this.players = this.teamState.listpitchplayers.playerstate.map(
      (playerstate) => new Player(this, playerstate)
    );
    this.name = this.teamState.data.name;
    this.id = this.teamState.data.teamid || 0;
    this.turn = this.teamState.gameturn || 0;
  }
}

export class Roll {
  static handledSkills = [];

  constructor(attrs) {
    Object.assign(this, attrs);

    this.teams = this.replaystep.boardstate.listteams.teamstate.map(
      (teamstate) => new Team(teamstate)
    );
    this.activeTeam =
      this.teams.filter(
        (team) => team.id == this.replaystep.boardstate.activeteam
      )[0] || this.teams[0];
    this.turn = (this.activeTeam && this.activeTeam.turn) || 0;
    this.activePlayer = this.playerById(this.action.playerid);
    this.rollType = this.boardactionresult.rolltype;
    this.dice = this.constructor.dice(this.boardactionresult);

    var unhandledSkills = this.skillsInEffect.filter(
      (skillinfo) => !this.constructor.handledSkills.includes(skillinfo.skillid)
    );
    if (unhandledSkills.length > 0) {
      console.warn("Unhandled skills for roll", {
        roll: this,
        skills: unhandledSkills.map(
          (skillinfo) => SKILL_NAME[skillinfo.skillid]
        ),
        rollName: this.constructor.rollName,
      });
    }
  }
  value(dice) {
    throw "value must be defined by subclass";
  }
  get expectedValue() {
    throw "expectedValue must be defined by subclass";
  }
  simulateDice() {
    throw "simulateDice must be defined by subclass";
  }

  ignore() {
    const dataPoint = this.actual;
    if (!isFinite(dataPoint.outcomeValue)) {
      console.warn("Dice roll with non-finite outcome value", {
        roll: this,
        dataPoint: dataPoint,
      });
      return true;
    }
    if (!isFinite(dataPoint.expectedValue)) {
      console.warn("Dice roll with non-finite expected value", {
        roll: this,
        dataPoint: dataPoint,
      });
      return true;
    }

    // As far as I can tell, this comes up when a reroll was possible but not used
    if (this.boardactionresult.rollstatus == 2) {
      return true;
    }

    return false;
  }
  static dice(boardactionresult) {
    return this.translateStringNumberList(
      boardactionresult.coachchoices.listdices
    );
  }
  get actual() {
    return Object.assign(this.dataPoint(0, this.dice, "actual"), {
      turn: this.turn,
      player: (this.activePlayer && this.activePlayer.name) || "",
      playerSkills:
        (this.activePlayer &&
          this.activePlayer.skills.map((skill) => SKILL_NAME[skill])) ||
        [],
      rollName: this.constructor.rollName || this.rollName || this.rollType,
      dice: this.dice,
    });
  }
  simulated(iteration) {
    return this.dataPoint(iteration, this.simulateDice(), "simulated");
  }

  dataPoint(iteration, dice, type) {
    return {
      iteration: iteration,
      turn: this.turn,
      stepIndex: this.stepIndex,
      actionIndex: this.actionIndex,
      resultIndex: this.resultIndex,
      activeTeamId: this.activeTeam.id,
      activeTeamName: this.activeTeam.name,
      teamId: this.activePlayer
        ? this.activePlayer.team.id
        : this.activeTeam.id,
      teamName: this.activePlayer
        ? this.activePlayer.team.name
        : this.activeTeam.name,
      outcomeValue:
        this.activePlayer.team.id === this.activeTeam.id
          ? this.value(dice)
          : -this.value(dice),
      type: type,
      expectedValue:
        this.activePlayer.team.id === this.activeTeam.id
          ? this.expectedValue
          : -this.expectedValue,
    };
  }

  playerById(playerId) {
    for (var team of this.teams) {
      for (var player of team.players) {
        if (player.id === playerId) {
          return player;
        }
      }
    }
  }

  playerAtPosition(cell) {
    for (var team of this.teams) {
      for (var player of team.players) {
        if (player.cell.x === cell.x && player.cell.y === cell.y) {
          return player;
        }
      }
    }
    console.log("No player found", {
      replaystep: this.replaystep,
      action: this.action,
      cell,
    });
  }

  static translateStringNumberList(str) {
    if (!str) return [];

    var stripped = str.substring(1, str.length - 1);
    var textList = stripped.split(",");

    var numberList = [];
    for (var i = 0; i < textList.length; i++) {
      numberList.push(parseInt(textList[i]));
    }
    return numberList;
  }

  static fromReplayStep(stepIndex, replaystep) {
    var actions = ensureList(replaystep.ruleseventboardaction);
    var rolls = [];
    for (var actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      var action = actions[actionIndex];
      rolls = rolls.concat(
        Roll.fromAction(stepIndex, replaystep, actionIndex, action)
      );
    }
    return rolls;
  }

  static fromAction(stepIndex, replaystep, actionIndex, action) {
    var results = ensureList(action.results.boardactionresult);
    var rolls = [];
    for (var resultIndex = 0; resultIndex < results.length; resultIndex++) {
      var result = results[resultIndex];
      var roll = this.fromBoardActionResult(
        stepIndex,
        replaystep,
        actionIndex,
        action,
        resultIndex,
        result
      );
      if (roll) {
        rolls.push(roll);
      }
    }
    if (results.length == 0) {
      console.warn("Unexpectedly missing boardactionresult", {
        stepIndex,
        replaystep,
        action,
      });
    }
    return rolls;
  }
  static fromBoardActionResult(
    stepIndex,
    replaystep,
    actionIndex,
    action,
    resultIndex,
    boardactionresult
  ) {
    if (boardactionresult.rolltype === undefined) {
      return null;
    }
    if (boardactionresult.coachchoices.listdices === undefined) {
      return null;
    }
    var rollClass = ROLL_TYPES[boardactionresult.rolltype];
    if (rollClass === null) {
      return null;
    }

    if (rollClass) {
      const roll = new rollClass({
        stepIndex,
        replaystep,
        actionIndex,
        action,
        resultIndex,
        boardactionresult,
      });
      if (roll.ignore()) {
        return null;
      } else {
        return roll;
      }
    } else {
      console.warn("Unknown roll " + boardactionresult.rolltype, {
        stepIndex,
        replaystep,
        actionIndex,
        action,
        resultIndex,
        boardactionresult,
      });
      return null;
    }
  }

  get skillsInEffect() {
    return ensureList(this.boardactionresult.coachchoices.listskills.skillinfo);
  }

  onActiveTeam(player) {
    return player.team.id === this.activeTeam.id;
  }

  playerValue(player) {
    return 1;
  }

  teamValue(team, situations) {
    return team.players
      .filter((player) => situations.includes(player.situation))
      .map((player) => this.playerValue(player))
      .reduce((a, b) => a + b, 0);
  }

  get halfTurnsLeft() {
    // Return the number of half-turns the player is unavailable times the
    // fraction of current team value it represents
    var halfTurns = this.teams.map((team) => {
      if (team.turn <= 16) {
        return 16 - team.turn;
      } else {
        return 24 - team.turn;
      }
    });
    return halfTurns[0] + halfTurns[1];
  }

  onPitchValue(player) {
    // The fraction of the teams on-pitch players that this player represents.
    return (
      this.playerValue(player) / this.teamValue(player.team, [SITUATION.Active])
    );
  }

  knockdownValue(player) {
    // Return the number of half-turns the player is unavailable times the
    // fraction of current team value it represents
    var playerValue = this.onPitchValue(player);
    if (this.onActiveTeam(player)) {
      return playerValue * Math.min(2, this.halfTurnsLeft);
    } else {
      return playerValue;
    }
  }

  stunValue(player) {
    // Return the number of half-turns the player is unavailable times the
    // fraction of current team value it represents
    var playerValue = this.onPitchValue(player);
    if (this.onActiveTeam(player)) {
      return playerValue * Math.min(3, this.halfTurnsLeft);
    } else {
      return playerValue * Math.min(4, this.halfTurnsLeft);
    }
  }

  koValue(player) {
    return (
      this.onPitchValue(player) * this.halfTurnsLeft - this.stunValue(player)
    );
  }

  casValue(player) {
    return this.koValue(player);
  }

  unactivatedPlayers() {
    return this.activeTeam.players.filter((player) => player.canAct);
  }

  turnoverValue() {
    var value = this.unactivatedPlayers()
      .filter((player) => player != this.activePlayer)
      .map((player) => this.onPitchValue(player))
      .reduce((a, b) => a + b, 0);
    return value;
  }
}

class BlockRoll extends Roll {
  static rollName = "Block";
  static handledSkills = [
    SKILL.Tackle,
    SKILL.Dodge,
    SKILL.Block,
    SKILL.Guard,
    SKILL.Horns,
    SKILL.StandFirm,
  ];

  static dice(boardactionresult) {
    var dice = super.dice(boardactionresult);
    // Block dice are doubled up, only use the first half of the dice list.
    return dice.slice(0, dice.length / 2).map(BlockRoll.asBlockDie);
  }

  ignore() {
    // Block dice have dice repeated for the coaches selection, resulttype is missing for the second one
    if (this.boardactionresult.resulttype != 2) {
      return true;
    }
    if (this.boardactionresult.subresulttype == 35) {
      // Opponent picking whether to activate fend
      return true;
    }
    if (this.boardactionresult.subresulttype == 57) {
      // Not sure what this is, but it doesn't have the expected number of dice.
      return true;
    }

    return super.ignore();
  }

  static asBlockDie(dieRoll) {
    switch (dieRoll) {
      case 0:
        return ATTACKER_DOWN;
      case 1:
        return BOTH_DOWN;
      case 2:
        return PUSH;
      case 3:
        return DEFENDER_STUMBLES;
      case 4:
        return DEFENDER_DOWN;
    }
  }

  dieValue(result, attacker, defender) {
    var attackerSkills = (attacker && attacker.skills) || [];
    var defenderSkills = (defender && defender.skills) || [];

    switch (result) {
      case ATTACKER_DOWN:
        return -this.knockdownValue(attacker) - this.turnoverValue();
      case BOTH_DOWN:
        if (attackerSkills.includes(SKILL.Block)) {
          if (defenderSkills.includes(SKILL.Block)) {
            return 0;
          } else {
            return this.knockdownValue(defender);
          }
        } else if (attackerSkills.includes(SKILL.Wrestle)) {
          return this.knockdownValue(defender) - this.knockdownValue(attacker);
        } else {
          return (
            this.knockdownValue(defender) -
            this.knockdownValue(attacker) -
            this.turnoverValue()
          );
        }
      case PUSH:
        return defenderSkills.includes(SKILL.StandFirm)
          ? 0
          : this.knockdownValue(defender) * 0.25;
      case DEFENDER_STUMBLES:
        if (
          defenderSkills.includes(SKILL.Dodge) &&
          !attackerSkills.includes(SKILL.Tackle)
        ) {
          return defenderSkills.includes(SKILL.StandFirm)
            ? 0
            : this.knockdownValue(defender) * 0.25;
        } else {
          return this.knockdownValue(defender);
        }
      case DEFENDER_DOWN:
        return this.knockdownValue(defender);
    }
  }

  get attacker() {
    return this.activePlayer;
  }

  get defender() {
    return this.playerAtPosition(this.action.order.cellto.cell);
  }

  value(dice) {
    // TODO: Handle values based on skills
    // TODO: Red Dice?
    var aSkills = this.playerSkills;
    return Math.max(
      ...dice.map((die) => this.dieValue(die, this.attacker, this.defender))
    );
  }
  get expectedValue() {
    var values;
    if (this.dice.length == 1) {
      values = BLOCK.values.map((dice) => this.value([dice]));
    } else {
      values = TWO_DIE_BLOCK.values.map((dice) => this.value(dice));
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  simulateDice() {
    return this.dice.map(() =>
      sample([
        ATTACKER_DOWN,
        BOTH_DOWN,
        PUSH,
        PUSH,
        DEFENDER_STUMBLES,
        DEFENDER_DOWN,
      ])
    );
  }
}

class FansRoll extends Roll {
  // TODO: Need to capture both teams rolls, because result is about comparison.
}

class ModifiedD6SumRoll extends Roll {
  constructor({ target, modifier, ...rest }) {
    super(rest);
    this.modifier =
      ensureList(this.boardactionresult.listmodifiers.dicemodifier || [])
        .map((modifier) => modifier.value)
        .reduce((a, b) => a + b, 0) || 0;
    this.target = this.boardactionresult.requirement;
  }

  get actual() {
    return Object.assign(super.actual, {
      target: this.modifiedTarget,
    });
  }
  get modifiedTarget() {
    if (this.dice.length == 1) {
      return Math.min(6, Math.max(2, this.target - this.modifier));
    } else {
      return this.target - this.modifier;
    }
  }
  value(dice) {
    if (dice.reduce((a, b) => a + b, 0) >= this.modifiedTarget) {
      return this.passValue();
    } else {
      return this.failValue();
    }
  }
  get expectedValue() {
    var diceSums = [0];
    for (var die = 0; die < this.dice.length; die++) {
      var newSums = [];
      for (var face = 1; face <= 6; face++) {
        for (const sum of diceSums) {
          newSums.push(sum + face);
        }
      }
      diceSums = newSums;
    }

    var numPossible = diceSums.length;
    var expected = 0;
    for (const sum of diceSums) {
      if (sum >= this.modifiedTarget) {
        expected += this.passValue() / numPossible;
      } else {
        expected += this.failValue() / numPossible;
      }
    }
    return expected;
  }
  simulateDice() {
    return this.dice.map(() => sample([1, 2, 3, 4, 5, 6]));
  }
  passValue() {
    return 0;
  }
  failValue() {
    return 0;
  }
}

class PickupRoll extends ModifiedD6SumRoll {
  static rollName = "Pickup";
  failValue() {
    return -this.turnoverValue();
  }
}

class BoneHeadRoll extends ModifiedD6SumRoll {
  static handledSkills = [SKILL.BoneHead];
  static rollName = "BoneHeadRoll";
  failValue() {
    return -this.knockdownValue(this.activePlayer);
  }
}

class ArmorRoll extends ModifiedD6SumRoll {
  static rollName = "Armor";
  static handledSkills = [SKILL.MightyBlow, SKILL.Claw];

  constructor({ ...rest }) {
    super(rest);

    // An Armor PileOn has a IsOrderCompleted RollType 60 right before it
    if (this.resultIndex == 0) {
      this.isPileOn = false;
    } else {
      var previousResult = this.action.results.boardactionresult[
        this.resultIndex - 1
      ];
      this.isPileOn = previousResult.rolltype == 59;
      if (this.isPileOn) {
        var previousSkills = previousResult.coachchoices.listskills.skillinfo;
        if (previousSkills && !previousSkills.length) {
          previousSkills = [previousSkills];
        }
        this.pilingOnPlayer = this.playerById(
          previousSkills.filter((skill) => skill.skillid == SKILL.PilingOn)[0]
            .playerid
        );
      }
    }
  }

  passValue() {
    // passValue is negative because "Passing" an armor roll means rolling higher than
    // armor, which is a bad thing.
    var injuredPlayerValue = -this.stunValue(this.activePlayer); // Player is at least stunned = out for 2 turns
    if (this.isPileOn) {
      // Using Piling On means the piling on player is out for a whole turn;
      return injuredPlayerValue + this.knockdownValue(this.pilingOnPlayer);
    } else {
      return injuredPlayerValue;
    }
  }

  failValue() {
    if (this.isPileOn) {
      // Using Piling On means the piling on player is out for a whole turn;
      return this.knockdownValue(this.pilingOnPlayer);
    } else {
      return 0;
    }
  }

  value(dice) {
    return super.value(dice);
  }
}

class WildAnimalRoll extends ModifiedD6SumRoll {
  static rollName = "Wild Animal";
  static handledSkills = [SKILL.WildAnimal];
  failValue() {
    // Failing Wild Animal means that this player is effectively unavailable
    // for the rest of your turn, but is active on your opponents turn
    return -this.onPitchValue(this.activePlayer);
  }
}

class DauntlessRoll extends ModifiedD6SumRoll {
  static rollName = "Dauntless";
  static handledSkills = [SKILL.Dauntless];
}

class DodgeRoll extends ModifiedD6SumRoll {
  static rollName = "Dodge";
  static handledSkills = [SKILL.BreakTackle, SKILL.Stunty];
  failValue() {
    return -this.knockdownValue(this.activePlayer) - this.turnoverValue();
  }
}

class JumpUpRoll extends ModifiedD6SumRoll {
  static handledSkills = [SKILL.JumpUp];
  static rollName = "Jump Up";
  failValue() {
    // Jump Up failure means the block fails to activate, so the player is no longer
    // available for this turn.
    return -this.onPitchValue(this.activePlayer);
  }
}

class LeapRoll extends ModifiedD6SumRoll {
  static rollName = "Leap";
  failValue() {
    return -this.knockdownValue(this.activePlayer) - this.turnoverValue();
  }
}

class PassRoll extends ModifiedD6SumRoll {
  static rollName = "Pass";
  failValue() {
    return -this.turnoverValue();
  }
}

class InterceptionRoll extends ModifiedD6SumRoll {
  static rollName = "Interception";
  // Interception rolls on the thrower, not the interceptee. If it "passes",
  // then the ball is caught
  passValue() {
    return -this.turnoverValue();
  }
}

class WakeUpRoll extends ModifiedD6SumRoll {
  static rollName = "Wake Up";

  constructor(attrs) {
    super(attrs);
    this.activeTeam = this.activePlayer.team;
  }
  passValue() {
    return this.koValue(this.activePlayer);
  }
}

class GFIRoll extends ModifiedD6SumRoll {
  static rollName = "GFI";
  failValue() {
    return -this.knockdownValue(this.activePlayer) - this.turnoverValue();
  }
}

class CatchRoll extends ModifiedD6SumRoll {
  static rollName = "Catch";
  static handledSkills = [SKILL.DisturbingPresence];

  failValue() {
    return -this.turnoverValue();
  }
}

class StandUpRoll extends ModifiedD6SumRoll {
  static rollName = "StandUp";

  passValue() {
    return this.knockdownValue(this.activePlayer);
  }
}

class InjuryRoll extends Roll {
  static rollName = "Injury";
  static handledSkills = [SKILL.MightyBlow, SKILL.DirtyPlayer, SKILL.Stunty];

  constructor({ ...rest }) {
    super(rest);

    // An Injury PileOn has a IsOrderCompleted RollType 60 right before it
    if (this.resultIndex == 0) {
      this.isPileOn = false;
    } else {
      var previousResult = this.action.results.boardactionresult[
        this.resultIndex - 1
      ];
      this.isPileOn = previousResult.rolltype == 60;
      if (this.isPileOn) {
        var previousSkills = ensureList(
          previousResult.coachchoices.listskills.skillinfo
        );
        this.pilingOnPlayer = this.playerById(
          previousSkills.filter((skill) => skill.skillid == SKILL.PilingOn)[0]
            .playerid
        );
      }
    }

    this.modifier =
      ensureList(this.boardactionresult.listmodifiers.dicemodifier || [])
        .map((modifier) => modifier.value)
        .reduce((a, b) => a + b, 0) || 0;
  }

  // TODO: Handle skills
  injuryValue(total) {
    if (this.activePlayer.skills.includes(SKILL.Stunty)) {
      total += 1;
    }
    if (total <= 7) {
      return 0; // Only stunned, no additional cost relative to armor break failure
    } else if (total <= 9) {
      return -this.koValue(this.activePlayer);
    } else {
      return -this.casValue(this.activePlayer);
    }
  }

  value(dice) {
    var total = dice[0] + dice[1] + this.modifier;
    if (this.isPileOn) {
      // Using Piling On means the piling on player is out for a whole turn;
      return this.injuryValue(total) + this.onPitchValue(this.pilingOnPlayer);
    } else {
      return this.injuryValue(total);
    }
  }
  get expectedValue() {
    var expected = 0;
    for (var first = 1; first <= 6; first++) {
      for (var second = 1; second <= 6; second++) {
        expected += this.value([first, second]);
      }
    }
    return expected / 36;
  }
  simulateDice() {
    return this.dice.map(() => sample([1, 2, 3, 4, 5, 6]));
  }
}

class CasualtyRoll extends Roll {
  static rollName = "Casualty";
  // TODO: Handle skills
  // TODO: Selecting the Apo result seems to read as a separate roll

  static dice(boardactionresult) {
    // Casualty dice are also doubled up, and also both rolls appear when an apoc is used (so the last one is the valid one)
    var dice = super.dice(boardactionresult);
    dice = dice.slice(0, dice.length / 2);
    return [dice[dice.length - 1]];
  }
  value(dice) {
    if (dice < 40) {
      return 0; // Badly Hurt
    } else if (dice < 50) {
      return -0.5; // MNG
    } else if (dice < 60) {
      return -0.75; // Stat Damage
    } else {
      return -1; // Dead
    }
  }
  get expectedValue() {
    var expected = 0;
    for (var type = 1; type <= 6; type++) {
      for (var subtype = 1; subtype <= 8; subtype++) {
        expected += this.value(type * 10 + subtype);
      }
    }
    return expected / 48;
  }
  simulateDice() {
    return sample([1, 2, 3, 4, 5, 6]) * 10 + sample([1, 2, 3, 4, 5, 6, 7, 8]);
  }
  ignore() {

    // Just guessing at this
    if (
      this.boardactionresult.resulttype != 2 &&
      this.boardactionresult.subresulttype != 1 &&
      // Replay Coach-551-9619f4910217db1915282ea2242c819f_2016-04-07_00_05_06, Furry Bears turn 8 crowdsurf injury, shouldn't be ignored
      this.boardactionresult.subresulttype != 12
    ) {
      console.warn("Ignoring casualty roll, should verify", { roll: this });
      return true;
    }
    return super.ignore();
  }
}

export const ROLL_TYPES = {
  1: GFIRoll,
  2: DodgeRoll,
  3: ArmorRoll,
  4: InjuryRoll,
  5: BlockRoll,
  6: StandUpRoll,
  7: PickupRoll,
  8: CasualtyRoll,
  9: CatchRoll,
  10: null, // Kickoff Scatter
  11: null, // Throw-in Roll
  12: PassRoll,
  13: null, // Push
  14: null, // Follow up
  // 15: null, // Foul Penalty
  16: InterceptionRoll,
  17: WakeUpRoll,
  20: BoneHeadRoll,
  //21: ReallyStupidRoll,
  22: WildAnimalRoll,
  //23: LonerRoll,
  //24: LandingRoll,
  26: null, // Inaccurate Pass Scatter
  //27: AlwaysHungryRoll,
  29: DauntlessRoll,
  31: JumpUpRoll,
  // 34: StabRoll,
  36: LeapRoll,
  // 37: FoulAppearanceRoll,
  // 40: TakeRootRoll,
  // 42: HailMaryPassRoll,
  // 45: ProRoll,
  // 46: HypnoticGazeRoll,
  // 54: FireballRoll,
  // 55: LightningBoltRoll,
  // 56: ThrowTeammateRoll,
  58: null, // Kickoff Gust
  59: ArmorRoll, // Armor Roll with Pile On. If followed by a RollType 59 w/ IsOrderCompleted, then PO happened. Otherwise, no PO
  60: InjuryRoll, // Injury Roll with Pile On. If followed by a RollType 60 w/ IsOrderCompleted, then PO happened, otherwise, no PO?
  61: null, // Some sort of wrestle roll that doesn't do anything
  63: null, // Carrier KD scatter
  // 69: FansRoll,
  70: null, // Weather
};

// TODO: Parse Kickoff events
