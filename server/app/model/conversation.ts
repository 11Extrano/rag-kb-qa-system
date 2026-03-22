import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

interface ConversationAttributes {
  conversation_id: string;
  created_at: Date;
  updated_at: Date;
}

type ConversationCreationAttributes = Optional<ConversationAttributes, 'created_at' | 'updated_at'>;

/** 对应表 `conversations`：一行一个客户端会话（UUID），供 `conversation_messages` 外键。 */
export default (app: Application) => {
  const ConversationModel = app.model.define<Model<ConversationAttributes, ConversationCreationAttributes>>(
    'conversations',
    {
      conversation_id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: 'conversations',
    },
  );

  return ConversationModel;
};
