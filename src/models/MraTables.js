const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
		return sequelize.define('MraTables', {
				table_id: {
						autoIncrement: true,
						type: DataTypes.INTEGER,
						allowNull: false,
						comment: "The primary key for the tables table. Uniquely identifies a table.",
						primaryKey: true
				},
				table_name: {
						type: DataTypes.STRING(255),
						allowNull: false,
						comment: "The name of the table. This is used to identify the table in access control policies."
				},
				customer_access_allowed: {
						type: DataTypes.BOOLEAN,
						allowNull: false,
						defaultValue: false,
						comment: "A boolean flag indicating whether customers are allowed access to this table. Defaults to FALSE."
				},
				cond: {
						type: DataTypes.TEXT,
						allowNull: true,
						comment: "Stores conditions related to access controls for this table. Used in evaluating access permissions."
				},
				attrs: {
						type: DataTypes.JSONB,
						allowNull: true,
						comment: "JSONB column storing attributes related to the table. These attributes can be used in access control evaluations."
				}
		}, {
				sequelize,
				tableName: 'mra_tables',
				schema: 'public',
				timestamps: false,
				underscored: true,
				freezeTableName: true,
				indexes: [
						{
								name: "mra_tables_pkey",
								unique: true,
								fields: [
										{ name: "table_id" },
								]
						},
				]
		});
};
