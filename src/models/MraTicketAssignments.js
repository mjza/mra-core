const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
		return sequelize.define('MraTicketAssignments', {
				assignment_id: {
						autoIncrement: true,
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "Primary key. Auto-incremented. By having this ID, we can assign\/discharge a ticket to\/from an agent at different points in time.",
						primaryKey: true
				},
				ticket_id: {
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "References mra_tickets. Indicates the ticket to which the agent is assigned.",
						references: {
								model: 'mra_tickets',
								key: 'ticket_id'
						}
				},
				agent_id: {
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "References mra_users. The agent who is assigned to the ticket.",
						references: {
								model: 'mra_users',
								key: 'user_id'
						}
				},
				assigner: {
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "References mra_users. The person who registered the assignment.",
						references: {
								model: 'mra_users',
								key: 'user_id'
						}
				},
				assigned_at: {
						type: DataTypes.DATE,
						allowNull: false,
						defaultValue: Sequelize.Sequelize.literal("(now() AT TIME ZONE 'UTC')"),
						comment: "Timestamp of when the ticket was assigned to the agent."
				},
				discharger: {
						type: DataTypes.INTEGER,
						allowNull: true,
						comment: "References mra_users. The person who registered the dischargement. Nullable.",
						references: {
								model: 'mra_users',
								key: 'user_id'
						}
				},
				discharged_at: {
						type: DataTypes.DATE,
						allowNull: true,
						comment: "Timestamp of when the ticket was discharged from the agent. Nullable."
				}
		}, {
				sequelize,
				tableName: 'mra_ticket_assignments',
				schema: 'public',
				timestamps: false,
				underscored: true,
				freezeTableName: true,
				indexes: [
						{
								name: "mra_ticket_assignments_pkey",
								unique: true,
								fields: [
										{ name: "assignment_id" },
								]
						},
				]
		});
};
