import { Column, PrimaryGeneratedColumn,CreateDateColumn,UpdateDateColumn,ManyToOne,OneToMany } from "typeorm";
import { CategoryStatus } from "./Enums/category.enum";
import { Entity } from "typeorm";
import { Product } from "../Product/Entity/product.entity";

@Entity('Catagories')
export class Category
{
    @PrimaryGeneratedColumn()
    id! :number ;
    @Column(
        {
            type: 'varchar',
            length: 20,
            unique : true,
        }
    )
    categoryId!: string ;

    @Column({
        type : 'varchar',
        length:100,
        unique: true
    })
    name !: string;
    @Column({
        type : 'varchar',
        nullable: true ,

    })
    description!: string | null;

    @Column({
        type : 'varchar',
        nullable: true,
    })
    image! : string | null;

    @Column(
        {
            type : 'enum',
            enum:CategoryStatus,
            default:CategoryStatus.ACTIVE
        }
    )
    status!: CategoryStatus;
     @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;


    @OneToMany(
    () => Product,
    (product) => product.category,
)
products!: Product[];


}