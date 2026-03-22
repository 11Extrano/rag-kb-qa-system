import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

interface ConversationMessageAttributes {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: Date;
  updated_at: Date;
}

type ConversationMessageCreationAttributes = Optional<
  ConversationMessageAttributes,
  'id' | 'created_at' | 'updated_at'
>;

/** 对应表 `conversation_messages`：按会话存 user/assistant 消息，顺序由自增 id 决定。 */
export default (app: Application) => {
  const MessageModel = app.model.define<Model<ConversationMessageAttributes, ConversationMessageCreationAttributes>>(
    'conversation_messages',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      conversation_id: {
        type: DataTypes.STRING(36),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM('user', 'assistant'),
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT('medium'),
        allowNull: false,
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: 'conversation_messages',
      indexes: [{ fields: ['conversation_id'] }],
    },
  );

  return MessageModel;
};
