import { Roll, MoveAction, UnknownRoll } from "./rolls.js";
import { END } from "./replay-utils.js";

export function processReplay(data) {
  //console.log("replay.processReplay");
  //console.log(data);

  var gameDetails = extractGameDetails(data);
  console.log("Extracted game details...", gameDetails);

  var playerDetails = {};
  var rolls = [];
  for (
    var stepIndex = 0;
    stepIndex < data.Replay.ReplayStep.length;
    stepIndex++
  ) {
    var replayStep = data.Replay.ReplayStep[stepIndex];
    replayStep.index = stepIndex;
    // extractPlayerDetails(replayStep, playerDetails);
    // extractActionsFromStep(replayStep, rolls);
    rolls = rolls.concat(Roll.fromReplayStep(
      data.Replay.ReplayStep[stepIndex - 1] && data.Replay.ReplayStep[stepIndex - 1].BoardState,
      stepIndex,
      replayStep
    ));
  }
  console.log("Extracted rolls...", { rolls });
  var validRolls = rolls.filter((roll) => !roll.ignore);
  validRolls = validRolls.reduce((rolls, nextRoll) => {
    if (rolls.length == 0) {
      return [nextRoll];
    }
    let lastRoll = rolls[rolls.length - 1];
    if (nextRoll instanceof MoveAction && lastRoll instanceof MoveAction && nextRoll.activePlayer.id == lastRoll.activePlayer.id && nextRoll.turn == lastRoll.turn) {
      lastRoll.cellTo = nextRoll.cellTo;
      return rolls;
    }
    let lastDependentRoll = lastRoll.dependentRolls && lastRoll.dependentRolls[lastRoll.dependentRolls.length - 1];
    if (nextRoll instanceof MoveAction && lastDependentRoll instanceof MoveAction && nextRoll.activePlayer.id == lastDependentRoll.activePlayer.id && nextRoll.turn == lastRoll.turn) {
      lastDependentRoll.cellTo = nextRoll.cellTo;
      return rolls;
    }

    if (
      lastRoll.isDependentRoll(nextRoll)
    ) {
      lastRoll.dependentRolls.push(nextRoll);
      return rolls;
    }
    rolls.push(nextRoll);
    return rolls;
  }, []);
  validRolls.forEach((roll, idx) => {
    roll.rollIndex = idx;
    roll.endIndex = rolls[idx + 1] ? rolls[idx + 1].startIndex : END;
  });
  console.log("Transformed rolls...", { validRolls });

  return {
    fullReplay: data.Replay,
    gameDetails: gameDetails,
    playerDetails: playerDetails,
    rolls: validRolls,
    unknownRolls: rolls.filter(roll => roll instanceof UnknownRoll),
    version: 1,
  };
}

export function extractGameDetails(jsonObject) {
  var firstStep = jsonObject.Replay.ReplayStep[0];
  var lastStep =
    jsonObject.Replay.ReplayStep[jsonObject.Replay.ReplayStep.length - 1];
  return {
    //fileName: lastStep.RulesEventGameFinished.MatchResult.Row.ReplayFilename,
    stadiumName: firstStep.GameInfos.NameStadium,
    stadiumType: firstStep.GameInfos.StructStadium,
    leagueName: firstStep.GameInfos.RowLeague.Name,
    homeTeam: {
      coachName: firstStep.GameInfos.CoachesInfos.CoachInfos[0].UserId,
      teamName: firstStep.BoardState.ListTeams.TeamState[0].Data.Name,
      raceId: firstStep.BoardState.ListTeams.TeamState[0].Data.IdRace,
      score: lastStep.RulesEventGameFinished.MatchResult.Row.HomeScore || 0,
    },
    awayTeam: {
      coachName: firstStep.GameInfos.CoachesInfos.CoachInfos[1].UserId,
      teamName: firstStep.BoardState.ListTeams.TeamState[1].Data.Name,
      raceId: firstStep.BoardState.ListTeams.TeamState[1].Data.IdRace,
      score: lastStep.RulesEventGameFinished.MatchResult.Row.AwayScore || 0,
    },
  };
}
