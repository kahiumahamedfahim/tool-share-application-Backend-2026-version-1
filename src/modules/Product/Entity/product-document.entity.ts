import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Product } from "./product.entity";

@Entity("product_documents")
export class ProductDocument
{
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({
        type: "varchar",
        length: 50,
    })
    productId!: string;

    @Column({
        type: "varchar",
        length: 500,
    })
    filePath!: string;

    @CreateDateColumn({
        type: "timestamp",
    })
    createdAt!: Date;

    @ManyToOne(
        () => Product,
        (product) => product.productDocuments,
    )
    @JoinColumn({
        name: "productId",
        referencedColumnName: "productId",
    })
    product!: Product;
}