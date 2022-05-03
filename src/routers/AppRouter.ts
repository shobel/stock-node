import { Request, Response, Router } from 'express';
import AppDao from '../dao/AppDao';
import PremiumDataManager from '../managers/PremiumDataManager';

const appRouter = Router();
const appDao = AppDao.getAppDaoInstance()

appRouter.get('/products', async (req: Request, res: Response) => {
    appDao.getProducts().then(products => {
        res.send(products)
    }).catch()
})

appRouter.get('/premium-packages', async (req: Request, res: Response) => {
    appDao.getPremiumPackages().then(packages => {
        res.send(packages)
    }).catch()
})
appRouter.get('/analysts-premium-package', async (req: Request, res: Response) => {
    appDao.getPremiumPackages().then(packages => {
        let p = packages.filter(p => p.id == PremiumDataManager.TOP_ANALYSTS_PACKAGE_ID)
        if (p.length){
            res.send(p[0])
        } else {
            res.send(null)
        }
    }).catch()
})

export default appRouter;
