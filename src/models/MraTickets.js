const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
		return sequelize.define('MraTickets', {
				ticket_id: {
						autoIncrement: true,
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "Primary key for the ticket record.",
						primaryKey: true
				},
				title: {
						type: DataTypes.STRING(255),
						allowNull: false,
						comment: "Title of the ticket. AI can use the title to suggest the best customer and category."
				},
				body: {
						type: DataTypes.TEXT,
						allowNull: true,
						comment: "Detailed description of the ticket."
				},
				customer_id: {
						type: DataTypes.INTEGER,
						allowNull: true,
						comment: "References mra_customers. Nullable: if set, only categories of the selected customer are shown. If the category is general, the customer can be determined through this field.",
						references: {
								model: 'mra_customers',
								key: 'customer_id'
						}
				},
				ticket_category_id: {
						type: DataTypes.INTEGER,
						allowNull: true,
						comment: "References mra_ticket_categories. Each customer might have its own list of categories.",
						references: {
								model: 'mra_ticket_categories',
								key: 'ticket_category_id'
						}
				},
				is_confidential: {
						type: DataTypes.BOOLEAN,
						allowNull: true,
						defaultValue: false,
						comment: "Indicates confidentiality. If set, only certain high-level roles can access it. Meaningful only if the customer is directly selected or identified via category type."
				},
				media_urls: {
						type: DataTypes.JSONB,
						allowNull: true,
						comment: "PostgreSQL JSONB type for storing media URLs associated with the ticket."
				},
				publisher: {
						type: DataTypes.INTEGER,
						allowNull: true,
						comment: "References mra_users. Indicates the person who confirmed a public ticket.",
						references: {
								model: 'mra_users',
								key: 'user_id'
						}
				},
				published_at: {
						type: DataTypes.DATE,
						allowNull: true,
						comment: "Timestamp of when the ticket was processed by the controller team or AI."
				},
				closed_at: {
						type: DataTypes.DATE,
						allowNull: true,
						comment: "Timestamp of when the ticket was closed."
				},
				close_reason: {
						type: DataTypes.TEXT,
						allowNull: true,
						comment: "Reason for the ticket closure."
				},
				latitude: {
						type: DataTypes.DECIMAL,
						allowNull: true,
						comment: "Latitude coordinate of the ticket location."
				},
				longitude: {
						type: DataTypes.DECIMAL,
						allowNull: true,
						comment: "Longitude coordinate of the ticket location."
				},
				geo_location: {
						type: DataTypes.GEOMETRY('POINT', 4326),
						allowNull: true,
						comment: "Geospatial data point (PostGIS POINT type) representing the ticket's geographical location."
				},
				creator: {
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "References mra_users. Indicates the reporter or the owner of the ticket.",
						references: {
								model: 'mra_users',
								key: 'user_id'
						}
				},
				created_at: {
						type: DataTypes.DATE,
						allowNull: false,
						defaultValue: Sequelize.Sequelize.literal("(now() AT TIME ZONE 'UTC')"),
						comment: "Timestamp of when the ticket was submitted."
				},
				updator: {
						type: DataTypes.INTEGER,
						allowNull: true,
						references: {
								model: 'mra_users',
								key: 'user_id'
						}
				},
				updated_at: {
						type: DataTypes.DATE,
						allowNull: true
				}
		}, {
				sequelize,
				tableName: 'mra_tickets',
				schema: 'public',
				hasTrigger: true,
				timestamps: false,
				underscored: true,
				freezeTableName: true,
				indexes: [
						{
								name: "mra_tickets_pkey",
								unique: true,
								fields: [
										{ name: "ticket_id" },
								]
						},
				]
		});
};
