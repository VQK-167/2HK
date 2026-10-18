class Workout {
  final String id;
  final int userId;
  final String name;
  final int minutes;
  final int calories;
  final String logDate;

  Workout({
    required this.id,
    required this.userId,
    required this.name,
    required this.minutes,
    required this.calories,
    required this.logDate,
  });

  factory Workout.fromJson(Map<String, dynamic> json) => Workout(
        id: json['id'].toString(),
        userId: json['user_id'] as int,
        name: json['name'] as String,
        minutes: json['minutes'] as int,
        calories: json['calories'] as int,
        logDate: json['log_date'] as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'name': name,
        'minutes': minutes,
        'calories': calories,
        'log_date': logDate,
      };
}

class DailyLog {
  final int userId;
  final String logDate;
  final int steps;
  final int waterMl;

  DailyLog({
    required this.userId,
    required this.logDate,
    this.steps = 0,
    this.waterMl = 0,
  });

  factory DailyLog.fromJson(Map<String, dynamic> json) => DailyLog(
        userId: json['user_id'] as int,
        logDate: json['log_date'] as String,
        steps: json['steps'] as int? ?? 0,
        waterMl: json['water_ml'] as int? ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'user_id': userId,
        'log_date': logDate,
        'steps': steps,
        'water_ml': waterMl,
      };
}

class Goal {
  final int userId;
  final int kcalGoal;
  final int stepGoal;
  final int waterGoal;

  Goal({
    required this.userId,
    this.kcalGoal = 2000,
    this.stepGoal = 10000,
    this.waterGoal = 2000,
  });

  factory Goal.fromJson(Map<String, dynamic> json) => Goal(
        userId: json['user_id'] as int,
        kcalGoal: json['kcal_goal'] as int? ?? 2000,
        stepGoal: json['step_goal'] as int? ?? 10000,
        waterGoal: json['water_goal'] as int? ?? 2000,
      );

  Map<String, dynamic> toJson() => {
        'user_id': userId,
        'kcal_goal': kcalGoal,
        'step_goal': stepGoal,
        'water_goal': waterGoal,
      };
}